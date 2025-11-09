import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { readExcerpt } from './fs';

const EMBEDDINGS_ENABLED = process.env.EMBEDDINGS_ENABLED === 'true';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CACHE_DIR = '/tmp/joinery-embeddings';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface EmbeddingIndex {
  vectors: Array<{ path: string; embedding: number[] }>;
  timestamp: number;
}

let memoryCache: EmbeddingIndex | null = null;
let cacheKey: string | null = null;

/**
 * Build or load an embedding index for the given file paths.
 * Uses OpenAI embeddings API if available and EMBEDDINGS_ENABLED=true.
 * Caches results in memory and /tmp for performance.
 */
export async function buildOrLoadIndex(
  paths: string[],
  repoRoot: string
): Promise<EmbeddingIndex | null> {
  if (!EMBEDDINGS_ENABLED || !OPENAI_API_KEY) {
    return null;
  }
  
  // Generate cache key from sorted paths
  const key = crypto
    .createHash('md5')
    .update(paths.sort().join('\n'))
    .digest('hex');
  
  // Check memory cache
  if (memoryCache && cacheKey === key) {
    const age = Date.now() - memoryCache.timestamp;
    if (age < CACHE_TTL_MS) {
      return memoryCache;
    }
  }
  
  // Check disk cache
  const cachePath = path.join(CACHE_DIR, `${key}.json`);
  try {
    const cached = await fs.readFile(cachePath, 'utf-8');
    const index: EmbeddingIndex = JSON.parse(cached);
    const age = Date.now() - index.timestamp;
    
    if (age < CACHE_TTL_MS) {
      memoryCache = index;
      cacheKey = key;
      return index;
    }
  } catch {
    // Cache miss or expired
  }
  
  // Build new index
  try {
    const index = await buildIndex(paths, repoRoot);
    
    // Save to disk cache
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(index));
    
    // Save to memory cache
    memoryCache = index;
    cacheKey = key;
    
    return index;
  } catch (err) {
    console.error('Failed to build embedding index:', err);
    return null;
  }
}

/**
 * Query the index for top-k most similar files to the query string.
 */
export async function queryIndex(
  query: string,
  topK: number,
  index: EmbeddingIndex | null
): Promise<string[]> {
  if (!index || !EMBEDDINGS_ENABLED || !OPENAI_API_KEY) {
    return [];
  }
  
  try {
    // Get embedding for query
    const queryEmbedding = await getEmbedding(query);
    
    // Calculate cosine similarity for each file
    const scored = index.vectors.map(({ path, embedding }) => ({
      path,
      similarity: cosineSimilarity(queryEmbedding, embedding),
    }));
    
    // Sort by similarity descending
    scored.sort((a, b) => b.similarity - a.similarity);
    
    // Return top-k paths
    return scored.slice(0, topK).map(s => s.path);
  } catch (err) {
    console.error('Failed to query embedding index:', err);
    return [];
  }
}

/**
 * Build embedding index from file paths.
 * Reads file excerpts and generates embeddings.
 */
async function buildIndex(
  paths: string[],
  repoRoot: string
): Promise<EmbeddingIndex> {
  const vectors: Array<{ path: string; embedding: number[] }> = [];
  
  // Limit to first 100 files to avoid rate limits and long build times
  const limitedPaths = paths.slice(0, 100);
  
  for (const p of limitedPaths) {
    try {
      const fullPath = path.join(repoRoot, p);
      const { text } = await readExcerpt(fullPath, { maxBytes: 8000 });
      
      // Create a short snippet for embedding (first 500 chars)
      const snippet = text.slice(0, 500);
      const embedding = await getEmbedding(`${p}\n\n${snippet}`);
      
      vectors.push({ path: p, embedding });
    } catch {
      // Skip files that can't be read or embedded
    }
  }
  
  return {
    vectors,
    timestamp: Date.now(),
  };
}

/**
 * Get embedding vector from OpenAI API.
 */
async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Calculate cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
