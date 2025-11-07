import imghash from "imghash";

export async function computePerceptualHash(imagePath: string): Promise<string> {
  try {
    const hash = await imghash.hash(imagePath, 16);
    return hash;
  } catch (error: any) {
    console.warn(`Failed to compute hash for ${imagePath}: ${error.message}`);
    return "";
  }
}

export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return Infinity;
  
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  
  return distance;
}

export function isDuplicate(
  hash: string,
  existingHashes: string[],
  threshold: number = 5
): boolean {
  for (const existingHash of existingHashes) {
    if (hammingDistance(hash, existingHash) <= threshold) {
      return true;
    }
  }
  return false;
}
