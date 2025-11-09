import fs from 'fs/promises';
import path from 'path';
import { listFilesWithAllowlist, readExcerpt, searchByKeywords } from '../src/services/retriever/fs';

// Use a test fixtures directory
const FIXTURES_DIR = path.join(__dirname, '../tmp/retriever-fixtures');

describe('listFilesWithAllowlist', () => {
  beforeAll(async () => {
    // Create test fixtures
    await fs.mkdir(FIXTURES_DIR, { recursive: true });
    await fs.mkdir(path.join(FIXTURES_DIR, 'src'), { recursive: true });
    await fs.mkdir(path.join(FIXTURES_DIR, 'api'), { recursive: true });
    await fs.mkdir(path.join(FIXTURES_DIR, 'node_modules'), { recursive: true });
    
    await fs.writeFile(path.join(FIXTURES_DIR, 'src/file1.ts'), 'content1');
    await fs.writeFile(path.join(FIXTURES_DIR, 'src/file2.tsx'), 'content2');
    await fs.writeFile(path.join(FIXTURES_DIR, 'api/route.ts'), 'content3');
    await fs.writeFile(path.join(FIXTURES_DIR, 'README.md'), 'readme');
    await fs.writeFile(path.join(FIXTURES_DIR, 'node_modules/package.js'), 'ignored');
  });
  
  afterAll(async () => {
    // Clean up fixtures
    await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
  });
  
  it('lists all files when no allowlist provided', async () => {
    const files = await listFilesWithAllowlist(FIXTURES_DIR, null);
    
    // Should include all files except node_modules
    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(files.some(f => f.includes('file1.ts'))).toBe(true);
    expect(files.some(f => f.includes('README.md'))).toBe(true);
    expect(files.some(f => f.includes('node_modules'))).toBe(false);
  });
  
  it('filters files by allowlist globs', async () => {
    const files = await listFilesWithAllowlist(FIXTURES_DIR, ['src/**/*.ts']);
    
    // Should only include TypeScript files in src
    expect(files.length).toBe(1);
    expect(files[0]).toContain('file1.ts');
  });
  
  it('supports multiple glob patterns', async () => {
    const files = await listFilesWithAllowlist(FIXTURES_DIR, ['src/**/*.tsx', 'api/**/*.ts']);
    
    expect(files.length).toBe(2);
    expect(files.some(f => f.includes('file2.tsx'))).toBe(true);
    expect(files.some(f => f.includes('route.ts'))).toBe(true);
  });
});

describe('readExcerpt', () => {
  const testFile = path.join(FIXTURES_DIR, 'test-excerpt.txt');
  
  beforeAll(async () => {
    await fs.mkdir(FIXTURES_DIR, { recursive: true });
    
    // Create a file with numbered lines
    const lines = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`);
    await fs.writeFile(testFile, lines.join('\n'));
  });
  
  afterAll(async () => {
    await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
  });
  
  it('reads entire file when no limits specified', async () => {
    const { text, clipped } = await readExcerpt(testFile);
    
    expect(text).toContain('Line 1');
    expect(text).toContain('Line 200');
    expect(clipped).toBe(false);
  });
  
  it('reads line range', async () => {
    const { text, clipped } = await readExcerpt(testFile, { start: 10, end: 15 });
    
    expect(text).toContain('Line 10');
    expect(text).toContain('Line 15');
    expect(text).not.toContain('Line 9');
    expect(text).not.toContain('Line 16');
    expect(clipped).toBe(true);
  });
  
  it('clips text when maxBytes exceeded', async () => {
    const { text, clipped } = await readExcerpt(testFile, { maxBytes: 100 });
    
    expect(text.length).toBeLessThanOrEqual(100);
    expect(clipped).toBe(true);
  });
  
  it('handles file read errors gracefully', async () => {
    const { text, clipped } = await readExcerpt('/nonexistent/file.txt');
    
    expect(text).toContain('[Error reading file');
    expect(clipped).toBe(false);
  });
});

describe('searchByKeywords', () => {
  const paths = [
    'src/components/ads/AdManager.tsx',
    'src/lib/tracking/ads.ts',
    'src/app/(admin)/ads/page.tsx',
    'src/services/xero/sync.ts',
    'src/services/xero/auth.ts',
    'src/components/LeadForm.tsx',
    'src/app/dashboard/leads/page.tsx',
  ];
  
  it('finds files by filename match', () => {
    const results = searchByKeywords(paths, ['ads'], 10);
    
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.includes('ads'))).toBe(true);
  });
  
  it('ranks exact filename matches higher than path matches', () => {
    const results = searchByKeywords(paths, ['ads'], 10);
    
    // ads.ts should rank higher than paths with ads directory
    const adsIndex = results.findIndex(r => r.includes('ads.ts'));
    expect(adsIndex).toBeGreaterThanOrEqual(0);
  });
  
  it('supports multiple keywords', () => {
    const results = searchByKeywords(paths, ['xero', 'sync'], 10);
    
    expect(results.some(r => r.includes('xero'))).toBe(true);
  });
  
  it('respects maxMatches limit', () => {
    const results = searchByKeywords(paths, ['page'], 2);
    
    expect(results.length).toBeLessThanOrEqual(2);
  });
  
  it('returns empty array for no keyword matches', () => {
    const results = searchByKeywords(paths, ['nonexistent'], 10);
    
    expect(results).toEqual([]);
  });
  
  it('is case-insensitive', () => {
    const results = searchByKeywords(paths, ['ADS', 'LeadForm'], 10);
    
    expect(results.length).toBeGreaterThan(0);
  });
});
