/**
 * 3D Asset Types
 * For GLB/GLTF component-level models (locks, hinges, handles, etc.)
 */

export interface AssetRecord {
  /** Unique ID (generated client-side or server-side) */
  id: string;
  /** Display name for the asset */
  name: string;
  /** MIME type: model/gltf-binary or model/gltf+json */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Base64-encoded data (no data URL prefix) */
  dataBase64: string;
  /** SHA-256 hash for deduplication (optional) */
  hash?: string;
  /** Timestamp of creation */
  createdAt: string;
  /** Metadata */
  metadata?: {
    originalFilename?: string;
    uploader?: string;
  };
}

/**
 * Profile Record Types
 * For SVG/DXF 2D profiles used for component extrusion
 */
export interface ProfileRecord {
  /** Unique ID (generated client-side or server-side) */
  id: string;
  /** Display name for the profile */
  name: string;
  /** MIME type: image/svg+xml or application/vnd.dxf */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Base64-encoded data (no data URL prefix) */
  dataBase64: string;
  /** SHA-256 hash for deduplication (optional) */
  hash?: string;
  /** Timestamp of creation */
  createdAt: string;
  /** Metadata */
  metadata?: {
    originalFilename?: string;
    uploader?: string;
  };
}

export interface AssetTransform {
  /** Position offset [x, y, z] in mm */
  position: [number, number, number];
  /** Rotation [rx, ry, rz] in radians */
  rotation: [number, number, number];
  /** Scale [sx, sy, sz] */
  scale: [number, number, number];
}

export interface AssetReference {
  /** Asset ID referencing AssetRecord */
  assetId: string;
  /** Transform to apply to model */
  transform?: AssetTransform;
  /** Optional anchor point label (e.g., "lock", "hinge_top") */
  anchor?: string;
}

export const DEFAULT_ASSET_TRANSFORM: AssetTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};
