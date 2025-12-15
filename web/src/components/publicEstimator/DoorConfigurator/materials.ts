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
 * Generate procedural wood grain texture with realistic continuous grain lines
 * Creates realistic wood grain depth without external textures
 */
export function generateWoodGrainTexture(
  width: number = 2048,
  height: number = 2048,
  grainIntensity: number = 0.4,
  grainScale: number = 1.0,
  isVertical: boolean = true
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Canvas context not available');
  
  // Base wood color with more realistic variation
  const gradient = ctx.createLinearGradient(0, 0, width * 0.3, 0);
  gradient.addColorStop(0, '#e6d9c3');
  gradient.addColorStop(0.3, '#ded2bd');
  gradient.addColorStop(0.7, '#d9cdb8');
  gradient.addColorStop(1, '#e3d6c0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Add fine texture variation for depth
  for (let i = 0; i < width; i += 3) {
    for (let j = 0; j < height; j += 3) {
      const variation = Math.random() * 10 - 5;
      ctx.fillStyle = `rgba(120, 85, 50, ${Math.abs(variation) * 0.004})`;
      ctx.fillRect(i, j, 3, 3);
    }
  }
  
  // Draw multiple layers of continuous grain for realistic depth with higher contrast
  const grainLayers = [
    { opacity: 0.24, width: 2.2, frequency: 0.008, amplitude: 5.5, offset: 0 },
    { opacity: 0.16, width: 1.6, frequency: 0.012, amplitude: 3.5, offset: 1.5 },
    { opacity: 0.11, width: 1.3, frequency: 0.016, amplitude: 2.2, offset: 0.8 },
    { opacity: 0.07, width: 0.9, frequency: 0.022, amplitude: 1.5, offset: 0.4 },
  ];
  
  grainLayers.forEach((layer) => {
    const grainSpacing = 5.5 * grainScale;
    const numGrains = Math.floor(width / grainSpacing);
    
    for (let i = 0; i < numGrains; i++) {
      const baseX = i * grainSpacing + (Math.random() * 2 - 1);
      
      ctx.strokeStyle = `rgba(75, 50, 25, ${layer.opacity})`;
      ctx.lineWidth = layer.width;
      ctx.beginPath();
      ctx.moveTo(baseX, 0);
      
      // Create smooth, continuous vertical grain with natural waviness
      for (let y = 0; y < height; y += 3) {
        const wave1 = Math.sin(y * layer.frequency + i * 0.6) * layer.amplitude;
        const wave2 = Math.sin(y * layer.frequency * 1.8 + i * 0.35) * (layer.amplitude * 0.55);
        const wave3 = Math.sin(y * layer.frequency * 0.35 + i * 0.15) * (layer.amplitude * 0.35);
        const waveOffset = wave1 + wave2 + wave3 + layer.offset;
        ctx.lineTo(baseX + waveOffset, y);
      }
      ctx.stroke();
    }
  });
  
  // Add realistic knots with concentric rings
  const numKnots = Math.floor((width * height) / 600000) + 2;
  for (let i = 0; i < numKnots; i++) {
    const knotX = Math.random() * width;
    const knotY = Math.random() * height;
    const knotRadius = 25 + Math.random() * 45;
    
    // Draw concentric rings for realistic knot appearance
    for (let r = knotRadius; r > 0; r -= 2.5) {
      const opacity = (1 - r / knotRadius) * 0.16;
      ctx.strokeStyle = `rgba(75, 48, 25, ${opacity})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(knotX, knotY, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  
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
    2048, 
    2048, 
    params.grainIntensity, 
    params.grainScale,
    true
  );
  
  const roughnessTexture = generateRoughnessMap(1024, 1024, params.roughness, 0.12);
  
  // Parse base color
  const color = new THREE.Color(params.baseColor);
  
  const material = new THREE.MeshStandardMaterial({
    map: grainTexture,
    color: color,
    roughness: params.roughness,
    metalness: params.metalness,
    roughnessMap: roughnessTexture,
    envMapIntensity: 0.35,
    side: THREE.FrontSide,
  });
  
  // Apply texture scaling for realistic size  
  material.map!.repeat.set(1, 1);
  material.roughnessMap!.repeat.set(1.5, 1.5);
  
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
