import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const USE_S3 = !!process.env.AWS_REGION && !!process.env.S3_BUCKET;

const s3Client = USE_S3
  ? new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null;

interface PutObjectParams {
  tenantSlug: string;
  buffer: Buffer;
  ext: string; // e.g., 'jpg', 'png', 'webp'
  filename?: string;
}

interface PutObjectResult {
  publicUrl: string;
  pathRelative: string; // relative to web/public or S3 bucket
}

/**
 * Store an asset (image, PDF, etc.) either to S3 or local filesystem
 */
export async function putObject({
  tenantSlug,
  buffer,
  ext,
  filename,
}: PutObjectParams): Promise<PutObjectResult> {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const finalFilename = filename || `${timestamp}_${randomSuffix}.${ext}`;
  const pathRelative = `tenants/${tenantSlug}/${finalFilename}`;

  if (USE_S3) {
    // Upload to S3
    const bucket = process.env.S3_BUCKET!;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: pathRelative,
      Body: buffer,
      ContentType: getContentType(ext),
      CacheControl: 'public, max-age=31536000',
    });

    await s3Client!.send(command);

    const publicBaseUrl = process.env.PUBLIC_BASE_URL || `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    const publicUrl = `${publicBaseUrl}/${pathRelative}`;

    return { publicUrl, pathRelative };
  } else {
    // Store locally in web/public/tenants/
    const localAssetDir = process.env.LOCAL_ASSET_DIR || join(process.cwd(), '../web/public/tenants');
    const fullPath = join(localAssetDir, tenantSlug, finalFilename);

    // Ensure directory exists
    mkdirSync(dirname(fullPath), { recursive: true });

    // Write buffer to file
    await pipeline(
      Readable.from(buffer),
      createWriteStream(fullPath)
    );

    const publicUrl = `/tenants/${tenantSlug}/${finalFilename}`;
    return { publicUrl, pathRelative };
  }
}

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
  };
  return types[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Generate a signed upload URL for client-side uploads (S3 only)
 * For local storage, client will POST buffer to API endpoint
 */
export async function getSignedUploadUrl(
  tenantSlug: string,
  ext: string
): Promise<{ uploadUrl?: string; method: 'local' | 's3' }> {
  if (!USE_S3) {
    return { method: 'local' };
  }

  // For S3, you'd typically use getSignedUrl from @aws-sdk/s3-request-presigner
  // For simplicity, we'll just return a flag indicating S3 mode
  // Client will POST to API which will handle the upload
  return { method: 's3' };
}
