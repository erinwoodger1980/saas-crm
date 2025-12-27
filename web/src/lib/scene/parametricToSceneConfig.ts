import type { SceneConfig } from '@/types/scene-config';
import type { ProductParams } from '@/types/parametric-builder';
import { buildScene } from '@/lib/scene/builder-registry';
import { calculateHeroCamera } from '@/lib/scene/fit-camera';
import { normalizeLightingConfig } from '@/lib/scene/normalize-lighting';
import { normalizeSceneConfig } from '@/lib/scene/config-validation';

export interface ParametricToSceneConfigArgs {
  tenantId: string;
  entityType: string;
  entityId: string;
  productParams: ProductParams;
  overrides?: Partial<ProductParams>;
}

type CacheEntry = {
  key: string;
  value: SceneConfig;
};

class LruCache {
  private max: number;
  private map = new Map<string, SceneConfig>();

  constructor(max = 20) {
    this.max = max;
  }

  get(key: string): SceneConfig | undefined {
    const value = this.map.get(key);
    if (!value) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: SceneConfig) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey) this.map.delete(oldestKey);
    }
  }
}

const sceneCache = new LruCache(25);

function stableStringify(value: any): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function buildCacheKey(args: ParametricToSceneConfigArgs): string {
  return stableStringify({
    tenantId: args.tenantId,
    entityType: args.entityType,
    entityId: args.entityId,
    productParams: args.productParams,
    overrides: args.overrides,
  });
}

function mergeParams(base: ProductParams, overrides?: Partial<ProductParams>): ProductParams {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    productType: overrides.productType || base.productType,
    dimensions: overrides.dimensions ? { ...base.dimensions, ...overrides.dimensions } : base.dimensions,
    construction: overrides.construction ? { ...base.construction, ...overrides.construction } : base.construction,
    materialRoleMap: overrides.materialRoleMap || base.materialRoleMap,
    materialOverrides: overrides.materialOverrides || base.materialOverrides,
  };
}

function buildVisibilityMap(components: any[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  const traverse = (node: any) => {
    map[node.id] = node.visible !== false;
    if (node.children) node.children.forEach(traverse);
  };
  components.forEach(traverse);
  return map;
}

export function parametricToSceneConfig(args: ParametricToSceneConfigArgs): SceneConfig {
  const cacheKey = buildCacheKey(args);
  const cached = sceneCache.get(cacheKey);
  if (cached) return cached;

  const mergedParams = mergeParams(args.productParams, args.overrides);
  const resolvedParams: ProductParams = args.overrides ? { ...mergedParams, overrides: args.overrides } : mergedParams;
  const result = buildScene(mergedParams);
  if (!result) {
    const fallback = normalizeSceneConfig({
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      dimensions: mergedParams.dimensions,
      components: [],
      materials: [],
    customData: resolvedParams,
    }) as SceneConfig;
    sceneCache.set(cacheKey, fallback);
    return fallback;
  }

  const sceneConfig: SceneConfig = {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    dimensions: {
      width: mergedParams.dimensions.width,
      height: mergedParams.dimensions.height,
      depth: mergedParams.dimensions.depth,
      bounds: {
        min: [-mergedParams.dimensions.width / 2, 0, -mergedParams.dimensions.depth / 2],
        max: [mergedParams.dimensions.width / 2, mergedParams.dimensions.height, mergedParams.dimensions.depth / 2],
      },
    },
    components: result.components,
    materials: result.materials,
    camera: {
      mode: 'Perspective',
      ...calculateHeroCamera({
        productWidth: mergedParams.dimensions.width,
        productHeight: mergedParams.dimensions.height,
        productDepth: mergedParams.dimensions.depth,
      }),
      rotation: [0, 0, 0],
      zoom: 1,
      fov: 45,
    },
    visibility: buildVisibilityMap(result.components),
    lighting: normalizeLightingConfig({
      boundsX: result.lighting.boundsX,
      boundsZ: result.lighting.boundsZ,
      intensity: 3.5,
      shadowCatcherDiameter: result.lighting.shadowCatcherDiameter,
      ambientIntensity: 1.2,
      castShadows: true,
    }),
    ui: {
      guides: false,
      axis: false,
      componentList: true,
      dimensions: false,
    },
    customData: resolvedParams,
    metadata: {
      productName: `${mergedParams.productType.category} - ${mergedParams.productType.type} - ${mergedParams.productType.option}`,
    },
  };

  const normalized = normalizeSceneConfig(sceneConfig) || sceneConfig;
  sceneCache.set(cacheKey, normalized);
  return normalized;
}
