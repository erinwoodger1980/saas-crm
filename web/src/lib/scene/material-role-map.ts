import { ProductParams } from '@/types/parametric-builder';

// Material role keys from the optional role map; fallback to string to avoid narrowing to undefined
export type MaterialRoleKey = keyof NonNullable<ProductParams['materialRoleMap']>;

export function deriveMaterialRoleMap(params: ProductParams): ProductParams['materialRoleMap'] {
  const timber = (params.construction?.timber || 'oak').toLowerCase();
  const finish = (params.construction?.finish || '').toLowerCase();

  const isPainted = finish.includes('paint');
  const isAccoya = timber.includes('accoya');

  const woodMaterialId = isAccoya ? 'accoya' : 'oak';
  const paintedWoodId = isAccoya ? 'painted-accoya' : 'painted-wood';

  const woodRoleId = isPainted ? paintedWoodId : woodMaterialId;

  return {
    FRAME_TIMBER: woodRoleId,
    PANEL_TIMBER: isPainted ? paintedWoodId : `${woodMaterialId}-veneer`,
    GLASS: 'glass',
    HARDWARE_METAL: 'chrome',
    SEAL_RUBBER: 'rubber',
    PAINT: isPainted ? paintedWoodId : 'paint',
  };
}

export function resolveMaterialId(
  role: MaterialRoleKey | undefined,
  componentId: string,
  roleMap: ProductParams['materialRoleMap'] | undefined,
  overrides: Record<string, string> | undefined
): string {
  if (overrides?.[componentId]) return overrides[componentId];
  if (role && overrides?.[role]) return overrides[role];
  if (role && overrides?.[`role:${role}`]) return overrides[`role:${role}`];
  if (role && roleMap?.[role]) return roleMap[role]!;
  return 'timber';
}
