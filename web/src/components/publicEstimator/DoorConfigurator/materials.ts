/**
 * PBR Material System for Photorealistic Door Rendering
 * Physically-Based Rendering materials with procedural textures
 */

import * as THREE from 'three';
import { DoorColor } from './types';

export interface WoodMaterialParams {
  baseColor: string;
  roughness: number;
  metalness: number;
  grainScale: number;
  grainIntensity: number;
  colorVariation: number;
}

export interface PaintedMaterialParams {
  baseColor: string;
  roughness: number;
  sheen: number;
  colorVariation: number;
}

/**
 * Generate procedural wood grain normal map
 * Creates realistic wood grain depth without external textures
 */
export function generateWoodGrainTexture(
  width: number = 1024,
  height: number = 1024,
  grainIntensity: number = 0.3,
  grainScale: number = 1.0
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Canvas context not available');
  
  // Base fill
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, width, height);
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Generate wood grain pattern using Perlin-like noise
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      
      // Primary grain (vertical with slight waviness)
      const grainX = x * grainScale / width;
      const grainY = y * grainScale / height;
      
      // Multiple octaves of noise for realistic grain
      let grain = 0;
      grain += Math.sin((grainX * 40 + Math.sin(grainY * 3) * 0.5) * Math.PI) * 0.4;
      grain += Math.sin((grainX * 80 + Math.sin(grainY * 7) * 0.3) * Math.PI) * 0.2;
      grain += Math.sin((grainX * 160 + Math.sin(grainY * 13) * 0.15) * Math.PI) * 0.1;
      
      // Add random knots
      const knotNoise = simplex2D(grainX * 10, grainY * 10) * 0.3;
      grain += knotNoise;
      
      // Normalize and apply intensity
      const normalizedGrain = (grain + 1) / 2; // 0 to 1
      const value = 128 + (normalizedGrain - 0.5) * 255 * grainIntensity;
      
      data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, value));
      data[i + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  
  return texture;
}

/**
 * Generate roughness map with variation
 * Simulates natural wood surface variation
 */
export function generateRoughnessMap(
  width: number = 512,
  height: number = 512,
  baseRoughness: number = 0.6,
  variation: number = 0.15
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Canvas context not available');
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      
      // Add subtle variation to roughness
      const noise = simplex2D(x / 50, y / 50);
      const roughness = baseRoughness + noise * variation;
      const value = Math.max(0, Math.min(1, roughness)) * 255;
      
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  
  return texture;
}

/**
 * Generate ambient occlusion map
 * Simulates edge darkening and joint shadows
 */
export function generateAOMap(
  width: number = 512,
  height: number = 512
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Canvas context not available');
  
  // Base white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  
  // Add edge darkening
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, width / 2
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  
  return texture;
}

/**
 * Create PBR wood material with procedural textures
 */
export function createWoodMaterial(params: WoodMaterialParams): THREE.MeshStandardMaterial {
  const grainTexture = generateWoodGrainTexture(
    1024, 
    1024, 
    params.grainIntensity, 
    params.grainScale
  );
  
  const roughnessTexture = generateRoughnessMap(512, 512, params.roughness, 0.15);
  const aoTexture = generateAOMap(512, 512);
  
  // Parse base color and add slight variation
  const color = new THREE.Color(params.baseColor);
  
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: params.roughness,
    metalness: params.metalness,
    normalMap: grainTexture,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughnessMap: roughnessTexture,
    aoMap: aoTexture,
    aoMapIntensity: 0.4,
    envMapIntensity: 0.8,
  });
  
  return material;
}

/**
 * Create painted/stained material with micro-roughness
 */
export function createPaintedMaterial(params: PaintedMaterialParams): THREE.MeshStandardMaterial {
  const roughnessTexture = generateRoughnessMap(512, 512, params.roughness, 0.08);
  const aoTexture = generateAOMap(512, 512);
  
  const color = new THREE.Color(params.baseColor);
  
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: params.roughness,
    metalness: 0.0,
    roughnessMap: roughnessTexture,
    aoMap: aoTexture,
    aoMapIntensity: 0.3,
    sheen: params.sheen,
    sheenColor: new THREE.Color(0xffffff),
    envMapIntensity: 0.5,
  });
  
  return material;
}

/**
 * Create glass material with proper refraction and reflection
 */
export function createGlassMaterial(opacity: number = 0.3): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xbbdefb),
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.9,
    thickness: 5,
    ior: 1.5,
    reflectivity: 0.5,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
  });
  
  return material;
}

/**
 * Create brass material for hardware
 */
export function createBrassMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xd4a574),
    metalness: 0.9,
    roughness: 0.2,
    envMapIntensity: 1.2,
  });
  
  return material;
}

/**
 * Get material parameters from door color configuration
 */
export function getMaterialParamsFromColor(doorColor: DoorColor): WoodMaterialParams | PaintedMaterialParams {
  if (doorColor.finish === 'natural' || doorColor.finish === 'stained') {
    return {
      baseColor: doorColor.hex,
      roughness: 0.65,
      metalness: 0.0,
      grainScale: doorColor.finish === 'natural' ? 1.2 : 1.0,
      grainIntensity: doorColor.finish === 'natural' ? 0.35 : 0.25,
      colorVariation: 0.08,
    };
  } else {
    return {
      baseColor: doorColor.hex,
      roughness: 0.4,
      sheen: 0.3,
      colorVariation: 0.03,
    };
  }
}

/**
 * Simple 2D Simplex noise implementation
 * For procedural texture generation
 */
function simplex2D(x: number, y: number): number {
  // Simplified noise function - in production, use a proper noise library
  const dot = (g: number[], x: number, y: number) => g[0] * x + g[1] * y;
  
  const grad3 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1]
  ];
  
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = x - X0;
  const y0 = y - Y0;
  
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;
  
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  
  const gi0 = grad3[Math.abs((i + j * 57) % 8)];
  const gi1 = grad3[Math.abs((i + i1 + (j + j1) * 57) % 8)];
  const gi2 = grad3[Math.abs((i + 1 + (j + 1) * 57) % 8)];
  
  let n0 = 0, n1 = 0, n2 = 0;
  
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) {
    t0 *= t0;
    n0 = t0 * t0 * dot(gi0, x0, y0);
  }
  
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) {
    t1 *= t1;
    n1 = t1 * t1 * dot(gi1, x1, y1);
  }
  
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) {
    t2 *= t2;
    n2 = t2 * t2 * dot(gi2, x2, y2);
  }
  
  return 70 * (n0 + n1 + n2);
}
