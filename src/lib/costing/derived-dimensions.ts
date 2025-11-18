export type LeafConfiguration = "Leaf Only" | "Single" | "Leaf & a Half" | "Double";

export interface DoorCostingInput {
  frameWidthMm: number | null;
  frameHeightMm: number | null;
  frameType: string | null;
  leafConfiguration: LeafConfiguration;
  numberOfLeaves: number;
  numberOfSidelight1: number;
  sidelight1WidthMm: number | null;
  numberOfSidelight2: number;
  sidelight2WidthMm: number | null;
  fanlightQty: number;
  fanlightHeightMm: number | null;
  wallThicknessMm: number | null;
  frameMaterial: string | null;
  liningThicknessJambsMm: number | null;
  masterLeafWidthMm: number | null;
  masterLeafAreaM2: number | null;
  slaveLeafAreaM2: number | null;
  masterLeafHeightMm: number | null;
  visionPanelQtyLeaf1: number;
  visionPanelQtyLeaf2: number;
  glassType: string | null;
  leafWeightCode: string | null;
  leafWeightPerM2Kg: number | null;
  coreType: string | null;
  coreWidthOverrideMm: number | null;
  coreThicknessMm: number | null;
  leafHeightMm: number | null;
  lippingMaterialId: string | null; // "0" means no lipping
  quantity: number;
  fireRatingCode: string | null;
  acousticRatingRw: number | null;
}

export interface DimensionRules {
  getTotalGapWidth(frameType: string, config: LeafConfiguration): number | null;
  getSoOffsetWidth(frameType: string, config: LeafConfiguration): number | null;
  getSoOffsetHeight(frameType: string, config: LeafConfiguration): number | null;
}

export type CoreSizeStatus = "ok" | "not-applicable" | "check-price" | "override" | "unknown";

export interface DerivedDimensions {
  soWidthMm: number | null;
  soHeightMm: number | null;
  openingWidthMm: number | null;
  openingHeightMm: number | null;
  extensionLiningVisibleMm: number | null;
  extensionLiningActualMm: number | null;
  frameThicknessMm: number | null;
  sLeafWidthMm: number | null;
  leafThicknessMm: number | null;
  coreWidthMm: number | null;
  coreWidthStatus: CoreSizeStatus | null;
  coreHeightMm: number | null;
  coreHeightStatus: CoreSizeStatus | null;
  lippingWidthMm: number | null;
  leafWeightPerM2Kg: number | null;
  masterLeafWeightKg: number | null;
  slaveLeafWeightKg: number | null;
}

interface CoreSizingResult {
  value: number | null;
  status: CoreSizeStatus | null;
}

const TIMBER_FRAME_MATERIALS = new Set([
  "mdf",
  "softwood",
  "hardwood",
  "oak",
  "ash",
  "maple",
  "sapele",
  "walnut",
  "beech",
  "steel",
  "stainless steel",
  "stainless_steel",
]);

const ENGINEERED_SOFTWOOD_ALIAS = new Set([
  "engineered_softwood",
  "engineered softwood",
]);

const FIRE_RATINGS_60MM = new Set(["fd90", "fd120", "fd90s", "fd120s"]);
const FIRE_RATINGS_54MM = new Set(["fd60", "fd60s"]);

export function calculateDerivedDimensions(
  input: DoorCostingInput,
  rules: DimensionRules
): DerivedDimensions {
  const isLeafOnly = input.leafConfiguration === "Leaf Only";
  const soWidthMm = !isLeafOnly ? normalizeNumber(input.frameWidthMm) : null;
  const soHeightMm = !isLeafOnly ? normalizeNumber(input.frameHeightMm) : null;

  const openingWidthMm = computeOpeningWidth({
    soWidthMm,
    frameType: input.frameType,
    configuration: input.leafConfiguration,
    rules,
    sidelight1Qty: input.numberOfSidelight1,
    sidelight1WidthMm: input.sidelight1WidthMm,
    sidelight2Qty: input.numberOfSidelight2,
    sidelight2WidthMm: input.sidelight2WidthMm,
  });

  const openingHeightMm = computeOpeningHeight({
    soHeightMm,
    frameType: input.frameType,
    configuration: input.leafConfiguration,
    rules,
    fanlightQty: input.fanlightQty,
    fanlightHeightMm: input.fanlightHeightMm,
  });

  const frameThicknessMm = computeFrameThickness(
    input.wallThicknessMm,
    input.frameMaterial
  );

  const extensionLiningVisibleMm = computeExtensionLiningVisible(
    input.wallThicknessMm,
    frameThicknessMm
  );

  const extensionLiningActualMm =
    extensionLiningVisibleMm == null ? null : extensionLiningVisibleMm + 10;

  const sLeafWidthMm = computeSlaveLeafWidth({
    configuration: input.leafConfiguration,
    openingWidthMm,
    frameType: input.frameType,
    rules,
    liningThicknessMm: input.liningThicknessJambsMm,
    masterLeafWidthMm: input.masterLeafWidthMm,
  });

  const leafThicknessMm = computeLeafThickness({
    quantity: input.quantity,
    fireRatingCode: input.fireRatingCode,
    acousticRatingRw: input.acousticRatingRw,
  });

  const coreWidthResult = computeCoreWidth({
    quantity: input.quantity,
    coreType: input.coreType,
    masterLeafWidthMm: input.masterLeafWidthMm,
    overrideWidthMm: input.coreWidthOverrideMm,
  });

  const coreHeightResult = computeCoreHeight({
    quantity: input.quantity,
    coreType: input.coreType,
    widthResult: coreWidthResult,
    leafHeightMm: input.leafHeightMm ?? openingHeightMm ?? input.masterLeafHeightMm ?? null,
  });

  const lippingWidthMm = computeLippingWidth({
    quantity: input.quantity,
    lippingMaterialId: input.lippingMaterialId,
    coreThicknessMm: input.coreThicknessMm,
  });

  const leafWeightPerM2Kg = input.quantity > 0 ? normalizeNumber(input.leafWeightPerM2Kg) : null;
  const masterLeafWeightKg = computeLeafWeight(
    leafWeightPerM2Kg,
    input.masterLeafAreaM2
  );
  const slaveLeafWeightKg = computeLeafWeight(
    leafWeightPerM2Kg,
    input.slaveLeafAreaM2
  );

  return {
    soWidthMm,
    soHeightMm,
    openingWidthMm,
    openingHeightMm,
    extensionLiningVisibleMm,
    extensionLiningActualMm,
    frameThicknessMm,
    sLeafWidthMm,
    leafThicknessMm,
    coreWidthMm: coreWidthResult.value,
    coreWidthStatus: coreWidthResult.status,
    coreHeightMm: coreHeightResult.value,
    coreHeightStatus: coreHeightResult.status,
    lippingWidthMm,
    leafWeightPerM2Kg,
    masterLeafWeightKg,
    slaveLeafWeightKg,
  };
}

export function computeOpeningWidth(params: {
  soWidthMm: number | null;
  frameType: string | null;
  configuration: LeafConfiguration;
  rules: DimensionRules;
  sidelight1Qty: number;
  sidelight1WidthMm: number | null;
  sidelight2Qty: number;
  sidelight2WidthMm: number | null;
}): number | null {
  const { soWidthMm, frameType, configuration, rules } = params;
  if (soWidthMm == null || !frameType) return null;
  const offset = rules.getSoOffsetWidth(frameType, configuration);
  if (offset == null) return null;
  const sidelightContribution = safeMultiply(params.sidelight1Qty, params.sidelight1WidthMm) +
    safeMultiply(params.sidelight2Qty, params.sidelight2WidthMm);
  return soWidthMm - offset - sidelightContribution;
}

export function computeOpeningHeight(params: {
  soHeightMm: number | null;
  frameType: string | null;
  configuration: LeafConfiguration;
  rules: DimensionRules;
  fanlightQty: number;
  fanlightHeightMm: number | null;
}): number | null {
  const { soHeightMm, frameType, configuration, rules } = params;
  if (soHeightMm == null || !frameType) return null;
  const offset = rules.getSoOffsetHeight(frameType, configuration);
  if (offset == null) return null;
  const fanlightContribution = safeMultiply(params.fanlightQty, params.fanlightHeightMm);
  return soHeightMm - offset - fanlightContribution;
}

export function computeFrameThickness(
  wallThicknessMm: number | null,
  frameMaterial: string | null
): number | null {
  const wall = normalizeNumber(wallThicknessMm);
  if (wall == null || !frameMaterial) return null;
  const normalizedMaterial = frameMaterial.trim().toLowerCase();
  if (TIMBER_FRAME_MATERIALS.has(normalizedMaterial)) {
    return Math.min(wall, 150);
  }
  if (ENGINEERED_SOFTWOOD_ALIAS.has(normalizedMaterial)) {
    return Math.min(wall, 235);
  }
  return null;
}

function computeExtensionLiningVisible(
  wallThicknessMm: number | null,
  frameThicknessMm: number | null
): number | null {
  const wall = normalizeNumber(wallThicknessMm);
  const frame = normalizeNumber(frameThicknessMm);
  if (wall == null || frame == null) return null;
  const diff = wall - frame;
  return Math.abs(diff) < 0.0001 ? null : diff;
}

export function computeSlaveLeafWidth(params: {
  configuration: LeafConfiguration;
  openingWidthMm: number | null;
  frameType: string | null;
  rules: DimensionRules;
  liningThicknessMm: number | null;
  masterLeafWidthMm: number | null;
}): number | null {
  const { configuration } = params;
  if (configuration === "Leaf Only") return null;
  if (configuration === "Single") return 0;

  const openingWidth = normalizeNumber(params.openingWidthMm);
  const liningThickness = normalizeNumber(params.liningThicknessMm);
  const frameType = params.frameType;
  if (openingWidth == null || liningThickness == null || !frameType) return null;
  const totalGapWidth = params.rules.getTotalGapWidth(frameType, configuration);
  if (totalGapWidth == null) return null;

  if (configuration === "Leaf & a Half") {
    const masterWidth = normalizeNumber(params.masterLeafWidthMm);
    if (masterWidth == null) return null;
    return openingWidth - totalGapWidth - 2 * liningThickness - masterWidth;
  }

  if (configuration === "Double") {
    return (openingWidth - totalGapWidth - 2 * liningThickness) / 2;
  }

  return null;
}

export function computeLeafThickness(params: {
  quantity: number;
  fireRatingCode: string | null;
  acousticRatingRw: number | null;
}): number | null {
  if (params.quantity <= 0) return null;
  const fire = params.fireRatingCode?.trim().toLowerCase() ?? "";
  if (FIRE_RATINGS_60MM.has(fire)) return 60;
  if (FIRE_RATINGS_54MM.has(fire) || (params.acousticRatingRw ?? 0) > 33) return 54;
  return 44;
}

export function computeCoreWidth(params: {
  quantity: number;
  coreType: string | null;
  masterLeafWidthMm: number | null;
  overrideWidthMm: number | null;
}): CoreSizingResult {
  if (params.quantity <= 0) return { value: null, status: null };
  if (!params.coreType) return { value: null, status: "not-applicable" };
  if (params.overrideWidthMm != null) {
    return { value: params.overrideWidthMm, status: "override" };
  }

  const masterWidth = normalizeNumber(params.masterLeafWidthMm);
  if (masterWidth == null || masterWidth <= 0) {
    return { value: null, status: "unknown" };
  }

  if (masterWidth > 1220) {
    return { value: null, status: "check-price" };
  }
  if (masterWidth > 930) {
    return { value: 1220, status: "ok" };
  }
  if (masterWidth > 0) {
    return { value: 915, status: "ok" };
  }
  return { value: null, status: "unknown" };
}

export function computeCoreHeight(params: {
  quantity: number;
  coreType: string | null;
  widthResult: CoreSizingResult;
  leafHeightMm: number | null;
}): CoreSizingResult {
  if (params.quantity <= 0) return { value: null, status: null };
  if (!params.coreType) return { value: null, status: "not-applicable" };

  if (params.widthResult.status === "not-applicable") {
    return { value: null, status: "not-applicable" };
  }
  if (params.widthResult.status === "check-price") {
    return { value: null, status: "check-price" };
  }

  const height = normalizeNumber(params.leafHeightMm);
  if (height == null || height <= 0) {
    return { value: null, status: "unknown" };
  }
  if (height > 2440) {
    return { value: null, status: "check-price" };
  }

  if (params.widthResult.value === 1220) {
    return { value: 2440, status: "ok" };
  }
  if (height > 2140) {
    return { value: 2440, status: "ok" };
  }
  if (height > 1) {
    return { value: 2135, status: "ok" };
  }
  return { value: null, status: "unknown" };
}

export function computeLippingWidth(params: {
  quantity: number;
  lippingMaterialId: string | null;
  coreThicknessMm: number | null;
}): number | null {
  if (params.quantity <= 0) return null;
  const hasLipping = params.lippingMaterialId && params.lippingMaterialId !== "0";
  if (!hasLipping) return 0;
  return normalizeNumber(params.coreThicknessMm) === 54 ? 58 : 48;
}

function computeLeafWeight(
  leafWeightPerM2Kg: number | null,
  leafAreaM2: number | null
): number | null {
  const density = normalizeNumber(leafWeightPerM2Kg);
  const area = normalizeNumber(leafAreaM2);
  if (density == null || area == null) return null;
  return density * area;
}

function safeMultiply(quantity: number | null | undefined, measurement: number | null | undefined): number {
  const qty = typeof quantity === "number" && Number.isFinite(quantity) ? quantity : 0;
  const size = typeof measurement === "number" && Number.isFinite(measurement) ? measurement : 0;
  return qty * size;
}

function normalizeNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value;
}
