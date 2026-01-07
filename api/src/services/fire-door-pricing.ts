/**
 * Fire Door Pricing Service
 * 
 * Calculates complete fire door prices using imported component data from:
 * - ComponentLookup table (cores, glass, ironmongery)
 * - Material table (timber, finishes, veneers)
 * 
 * Integrates with existing BOM generator and door pricing engine
 * 
 * @module fire-door-pricing
 */

import { PrismaClient } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface FireDoorConfig {
  // Basic dimensions
  masterLeafWidth: number;      // mm
  masterLeafHeight: number;     // mm (leaf height)
  slaveLeafWidth?: number;      // mm (for double doors)
  leafThickness: number;        // mm (44, 54, 64, etc.)
  leafCount: number;            // 1 or 2
  quantity: number;             // Number of complete door sets

  // Fire rating
  fireRating: 'FD30' | 'FD60' | 'FD90' | 'FD120' | 'None';

  // Core selection
  coreType: string;             // e.g., "STREBORD-FD60-54MM"

  // Lipping
  lippingMaterial: string;      // Material code, e.g., "OAK-LIPPING-10MM"
  lippingThickness?: number;    // mm (typically 8-10mm)

  // Facing/finish
  doorFacing: string;           // e.g., "PAINT", "VENEER", "PVC_WRAP"
  doorFinishSide1?: string;     // Specific finish code

  // Glass/vision panels
  visionPanelQty1?: number;
  vp1Width?: number;            // mm
  vp1Height?: number;           // mm
  glassType?: string;           // e.g., "PYROGUARD-60-44"

  // Frame
  includeFrame: boolean;
  frameWidth?: number;          // mm (overall opening width)
  frameHeight?: number;         // mm (overall opening height)
  frameMaterial?: string;       // Material code

  // Ironmongery
  hingeSupplyType?: 'Supplied' | 'Not Supplied' | 'Factory Fitted';
  hingeType?: string;
  hingeQty?: number;
  lockType1?: string;
  lockSupplyType1?: 'Supplied' | 'Not Supplied' | 'Factory Fitted';
  closerType?: string;
  closerSupplyType?: 'Supplied' | 'Not Supplied' | 'Factory Fitted';

  // Additional options
  factoryFitIronmongery?: boolean;
  preMachineForIronmongery?: boolean;
}

export interface MaterialLineItem {
  category: string;
  description: string;
  code: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  source: 'ComponentLookup' | 'Material';
  componentId?: string;
  materialId?: string;
  formula?: string;
}

export interface LabourLineItem {
  operation: string;
  minutes: number;
  ratePerHour: number;
  cost: number;
}

export interface FireDoorPriceBreakdown {
  config: FireDoorConfig;
  materials: MaterialLineItem[];
  labour: LabourLineItem[];
  
  materialsCostTotal: number;
  labourCostTotal: number;
  subtotal: number;
  overhead: number;
  overheadPercent: number;
  preMarginTotal: number;
  margin: number;
  marginPercent: number;
  finalPrice: number;
  
  pricePerDoor: number;
  quantity: number;
}

export interface PricingOptions {
  overheadPercent?: number;     // Default 15%
  marginPercent?: number;        // Default 25%
  shopRatePerHour?: number;      // Default £45/hour
  includeLabour?: boolean;       // Default true
}

// ============================================================================
// FIRE DOOR PRICING SERVICE
// ============================================================================

export class FireDoorPricingService {
  constructor(
    private prisma: PrismaClient,
    private tenantId: string
  ) {}

  /**
   * Calculate complete price breakdown for a fire door configuration
   */
  async calculatePrice(
    config: FireDoorConfig,
    options: PricingOptions = {}
  ): Promise<FireDoorPriceBreakdown> {
    const {
      overheadPercent = 15,
      marginPercent = 25,
      shopRatePerHour = 45,
      includeLabour = true,
    } = options;

    // 1. Build material requirements
    const materials = await this.buildMaterialRequirements(config);

    // 2. Calculate labour
    const labour = includeLabour
      ? await this.calculateLabour(config, shopRatePerHour)
      : [];

    // 3. Calculate totals
    const materialsCostTotal = materials.reduce((sum, m) => sum + m.totalCost, 0);
    const labourCostTotal = labour.reduce((sum, l) => sum + l.cost, 0);
    const subtotal = materialsCostTotal + labourCostTotal;
    const overhead = subtotal * (overheadPercent / 100);
    const preMarginTotal = subtotal + overhead;
    const margin = preMarginTotal * (marginPercent / 100);
    const finalPrice = preMarginTotal + margin;

    return {
      config,
      materials,
      labour,
      materialsCostTotal,
      labourCostTotal,
      subtotal,
      overhead,
      overheadPercent,
      preMarginTotal,
      margin,
      marginPercent,
      finalPrice,
      pricePerDoor: finalPrice / config.quantity,
      quantity: config.quantity,
    };
  }

  /**
   * Build complete material requirements from config
   */
  private async buildMaterialRequirements(
    config: FireDoorConfig
  ): Promise<MaterialLineItem[]> {
    const materials: MaterialLineItem[] = [];

    // 1. Door cores
    const coreMaterial = await this.lookupCore(config.coreType, config.leafThickness);
    if (coreMaterial) {
      materials.push({
        category: 'CORE',
        description: `Door core - ${config.coreType}`,
        code: coreMaterial.code,
        quantity: config.leafCount * config.quantity,
        unit: 'EA',
        unitCost: coreMaterial.basePrice,
        totalCost: coreMaterial.basePrice * config.leafCount * config.quantity,
        source: 'ComponentLookup',
        componentId: coreMaterial.id,
      });
    }

    // 2. Lipping
    const lippingMaterial = await this.lookupLipping(config.lippingMaterial);
    if (lippingMaterial) {
      // Calculate perimeter
      const masterPerimeter = (config.masterLeafWidth + config.masterLeafHeight) * 2;
      const slavePerimeter = config.slaveLeafWidth
        ? (config.slaveLeafWidth + config.masterLeafHeight) * 2
        : 0;
      const totalPerimeterMm = (masterPerimeter + slavePerimeter) * config.quantity;
      const totalPerimeterM = totalPerimeterMm / 1000;

      const lippingUnitCost = Number(lippingMaterial.unitCost);
      materials.push({
        category: 'LIPPING',
        description: `Lipping - ${config.lippingMaterial}`,
        code: lippingMaterial.code,
        quantity: totalPerimeterM,
        unit: 'M',
        unitCost: lippingUnitCost,
        totalCost: lippingUnitCost * totalPerimeterM,
        source: 'Material',
        materialId: lippingMaterial.id,
      });
    }

    // 3. Glass (if vision panels)
    if (config.visionPanelQty1 && config.vp1Width && config.vp1Height && config.glassType) {
      const glassMaterial = await this.lookupGlass(config.glassType, config.fireRating);
      if (glassMaterial) {
        const areaPerPanel = (config.vp1Width * config.vp1Height) / 1_000_000; // mm² to m²
        const totalArea = areaPerPanel * config.visionPanelQty1 * config.leafCount * config.quantity;

        materials.push({
          category: 'GLASS',
          description: `Fire-rated glass - ${config.glassType}`,
          code: glassMaterial.code,
          quantity: totalArea,
          unit: 'M2',
          unitCost: glassMaterial.basePrice,
          totalCost: glassMaterial.basePrice * totalArea,
          source: 'ComponentLookup',
          componentId: glassMaterial.id,
        });
      }
    }

    // 4. Facing/finish
    const facingMaterial = await this.lookupFinish(config.doorFacing);
    if (facingMaterial) {
      const leafArea = (config.masterLeafWidth * config.masterLeafHeight) / 1_000_000; // mm² to m²
      const slaveArea = config.slaveLeafWidth
        ? (config.slaveLeafWidth * config.masterLeafHeight) / 1_000_000
        : 0;
      const totalArea = (leafArea + slaveArea) * 2 * config.quantity; // Both sides

      const facingUnitCost = Number(facingMaterial.unitCost);
      materials.push({
        category: 'FINISH',
        description: `Finish - ${config.doorFacing}`,
        code: facingMaterial.code,
        quantity: totalArea,
        unit: 'M2',
        unitCost: facingUnitCost,
        totalCost: facingUnitCost * totalArea,
        source: 'Material',
        materialId: facingMaterial.id,
      });
    }

    // 5. Ironmongery - Hinges
    if (config.hingeSupplyType === 'Supplied' || config.hingeSupplyType === 'Factory Fitted') {
      if (config.hingeType && config.hingeQty) {
        const hinge = await this.lookupIronmongery(config.hingeType);
        if (hinge) {
          const totalQty = config.hingeQty * config.leafCount * config.quantity;
          materials.push({
            category: 'IRONMONGERY',
            description: `Hinges - ${config.hingeType}`,
            code: hinge.code,
            quantity: totalQty,
            unit: 'EA',
            unitCost: hinge.basePrice,
            totalCost: hinge.basePrice * totalQty,
            source: 'ComponentLookup',
            componentId: hinge.id,
          });
        }
      }
    }

    // 6. Ironmongery - Lock
    if (config.lockSupplyType1 === 'Supplied' || config.lockSupplyType1 === 'Factory Fitted') {
      if (config.lockType1) {
        const lock = await this.lookupIronmongery(config.lockType1);
        if (lock) {
          const totalQty = config.quantity; // 1 lock per door set
          materials.push({
            category: 'IRONMONGERY',
            description: `Lock - ${config.lockType1}`,
            code: lock.code,
            quantity: totalQty,
            unit: 'EA',
            unitCost: lock.basePrice,
            totalCost: lock.basePrice * totalQty,
            source: 'ComponentLookup',
            componentId: lock.id,
          });
        }
      }
    }

    // 7. Ironmongery - Closer
    if (config.closerSupplyType === 'Supplied' || config.closerSupplyType === 'Factory Fitted') {
      if (config.closerType) {
        const closer = await this.lookupIronmongery(config.closerType);
        if (closer) {
          const totalQty = config.leafCount * config.quantity; // 1 closer per leaf
          materials.push({
            category: 'IRONMONGERY',
            description: `Door closer - ${config.closerType}`,
            code: closer.code,
            quantity: totalQty,
            unit: 'EA',
            unitCost: closer.basePrice,
            totalCost: closer.basePrice * totalQty,
            source: 'ComponentLookup',
            componentId: closer.id,
          });
        }
      }
    }

    // 8. Frame (if included)
    if (config.includeFrame && config.frameWidth && config.frameHeight && config.frameMaterial) {
      const frameMaterial = await this.lookupFrameMaterial(config.frameMaterial);
      if (frameMaterial) {
        const framePerimeter = (config.frameWidth + config.frameHeight) * 2;
        const totalPerimeterM = (framePerimeter * config.quantity) / 1000;

        const frameUnitCost = Number(frameMaterial.unitCost);
        materials.push({
          category: 'FRAME',
          description: `Frame material - ${config.frameMaterial}`,
          code: frameMaterial.code,
          quantity: totalPerimeterM,
          unit: 'M',
          unitCost: frameUnitCost,
          totalCost: frameUnitCost * totalPerimeterM,
          source: 'Material',
          materialId: frameMaterial.id,
        });
      }
    }

    return materials;
  }

  /**
   * Calculate labour costs
   */
  private async calculateLabour(
    config: FireDoorConfig,
    shopRatePerHour: number
  ): Promise<LabourLineItem[]> {
    const labour: LabourLineItem[] = [];
    const costPerMinute = shopRatePerHour / 60;

    // Base times (minutes per door)
    const baseTimes = {
      cutting: 15,           // Cut core to size
      edgeBanding: 20,       // Apply lipping
      machining: 30,         // CNC/routing
      assembly: 45,          // Frame assembly
      finishing: config.doorFacing === 'PAINT' ? 60 : 30, // Paint or veneer
    };

    // Adjust for complexity
    let machiningTime = baseTimes.machining;

    // Vision panels add machining time
    if (config.visionPanelQty1) {
      machiningTime += 20 * config.visionPanelQty1;
    }

    // Pre-machining for ironmongery
    if (config.preMachineForIronmongery) {
      if (config.lockType1) machiningTime += 15;
      if (config.hingeQty) machiningTime += 10;
      if (config.closerType) machiningTime += 10;
    }

    // Factory fit ironmongery adds assembly time
    let assemblyTime = baseTimes.assembly;
    if (config.factoryFitIronmongery) {
      if (config.lockType1) assemblyTime += 15;
      if (config.hingeQty) assemblyTime += 5 * config.hingeQty;
      if (config.closerType) assemblyTime += 10;
    }

    // Calculate total time per door
    const timePerDoor = {
      cutting: baseTimes.cutting,
      edgeBanding: baseTimes.edgeBanding,
      machining: machiningTime,
      assembly: assemblyTime,
      finishing: baseTimes.finishing,
    };

    // Multiply by quantity
    for (const [operation, minutes] of Object.entries(timePerDoor)) {
      const totalMinutes = minutes * config.quantity;
      labour.push({
        operation,
        minutes: totalMinutes,
        ratePerHour: shopRatePerHour,
        cost: totalMinutes * costPerMinute,
      });
    }

    return labour;
  }

  // ============================================================================
  // LOOKUP METHODS
  // ============================================================================

  /**
   * Lookup door core from ComponentLookup
   */
  private async lookupCore(coreType: string, thickness: number) {
    return await this.prisma.componentLookup.findFirst({
      where: {
        tenantId: this.tenantId,
        componentType: 'DOOR_CORE',
        OR: [
          { code: { contains: coreType, mode: 'insensitive' } },
          { name: { contains: coreType, mode: 'insensitive' } },
        ],
        metadata: {
          path: ['thickness'],
          equals: thickness,
        },
      },
    });
  }

  /**
   * Lookup lipping material from Material table
   */
  private async lookupLipping(materialCode: string) {
    return await this.prisma.material.findFirst({
      where: {
        tenantId: this.tenantId,
        category: { in: ['TIMBER_HARDWOOD', 'TIMBER_SOFTWOOD'] },
        OR: [
          { code: { contains: materialCode, mode: 'insensitive' } },
          { name: { contains: materialCode, mode: 'insensitive' } },
          { code: { contains: 'LIPPING', mode: 'insensitive' } },
        ],
      },
    });
  }

  /**
   * Lookup glass from ComponentLookup
   */
  private async lookupGlass(glassType: string, fireRating: string) {
    return await this.prisma.componentLookup.findFirst({
      where: {
        tenantId: this.tenantId,
        componentType: 'GLASS',
        OR: [
          { code: { contains: glassType, mode: 'insensitive' } },
          { name: { contains: glassType, mode: 'insensitive' } },
        ],
        metadata: {
          path: ['fireRating'],
          string_contains: fireRating.replace('FD', ''), // Match "60" from "FD60"
        },
      },
    });
  }

  /**
   * Lookup finish material from Material table
   */
  private async lookupFinish(facingType: string) {
    return await this.prisma.material.findFirst({
      where: {
        tenantId: this.tenantId,
        category: { in: ['VENEER_SHEET', 'BOARD_MDF'] },
        OR: [
          { code: { contains: facingType, mode: 'insensitive' } },
          { name: { contains: facingType, mode: 'insensitive' } },
        ],
      },
    });
  }

  /**
   * Lookup ironmongery from ComponentLookup
   */
  private async lookupIronmongery(itemCode: string) {
    return await this.prisma.componentLookup.findFirst({
      where: {
        tenantId: this.tenantId,
        componentType: 'IRONMONGERY',
        OR: [
          { code: { contains: itemCode, mode: 'insensitive' } },
          { name: { contains: itemCode, mode: 'insensitive' } },
        ],
      },
    });
  }

  /**
   * Lookup frame material from Material table
   */
  private async lookupFrameMaterial(materialCode: string) {
    return await this.prisma.material.findFirst({
      where: {
        tenantId: this.tenantId,
        category: { in: ['TIMBER_HARDWOOD', 'TIMBER_SOFTWOOD'] },
        OR: [
          { code: { contains: materialCode, mode: 'insensitive' } },
          { name: { contains: materialCode, mode: 'insensitive' } },
        ],
      },
    });
  }
}

// ============================================================================
// HELPER: GENERATE BOM FROM FIRE DOOR CONFIG
// ============================================================================

/**
 * Generate BOM from fire door config using ComponentLookup inclusion rules
 * This integrates with the existing BOM generator service
 */
export async function generateFireDoorBOM(
  tenantId: string,
  config: FireDoorConfig,
  prisma: PrismaClient
): Promise<{
  lineItems: any[];
  totalCost: number;
}> {
  const service = new FireDoorPricingService(prisma, tenantId);
  const breakdown = await service.calculatePrice(config);

  // Convert materials to BOM line items
  const lineItems = breakdown.materials.map((material) => ({
    componentId: material.componentId || material.materialId,
    componentCode: material.code,
    componentName: material.description,
    quantity: material.quantity,
    unit: material.unit,
    unitCost: material.unitCost,
    totalCost: material.totalCost,
    category: material.category,
    source: material.source,
  }));

  return {
    lineItems,
    totalCost: breakdown.materialsCostTotal,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default FireDoorPricingService;
