import type { ProductParams } from '@/types/parametric-builder';

export function diffProductParams(base: ProductParams, current: ProductParams): Partial<ProductParams> {
  const overrides: Partial<ProductParams> = {};

  if (JSON.stringify(base.productType) !== JSON.stringify(current.productType)) {
    overrides.productType = current.productType;
  }

  if (JSON.stringify(base.dimensions) !== JSON.stringify(current.dimensions)) {
    overrides.dimensions = { ...current.dimensions };
  }

  const constructionDiff: Record<string, any> = {};
  Object.keys(current.construction || {}).forEach((key) => {
    const currentValue = (current.construction as any)[key];
    const baseValue = (base.construction as any)?.[key];
    if (JSON.stringify(currentValue) !== JSON.stringify(baseValue)) {
      constructionDiff[key] = currentValue;
    }
  });
  if (Object.keys(constructionDiff).length > 0) {
    overrides.construction = constructionDiff;
  }

  if (JSON.stringify(base.materialRoleMap || {}) !== JSON.stringify(current.materialRoleMap || {})) {
    overrides.materialRoleMap = current.materialRoleMap;
  }

  if (JSON.stringify(base.materialOverrides || {}) !== JSON.stringify(current.materialOverrides || {})) {
    overrides.materialOverrides = current.materialOverrides;
  }

  if (JSON.stringify(base.addedParts || []) !== JSON.stringify(current.addedParts || [])) {
    overrides.addedParts = current.addedParts;
  }

  return overrides;
}
