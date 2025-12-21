/**
 * Resolved Product Type System
 * 
 * This defines the runtime data model after AI template generation and expression evaluation.
 * A ResolvedProduct contains all concrete geometry, materials, hardware, BOM, and pricing.
 */

export type ComponentKind = 
  | 'profileExtrusion' 
  | 'panel' 
  | 'glass' 
  | 'gltf' 
  | 'seal' 
  | 'misc';

export type MaterialRole = 
  | 'timber' 
  | 'panelCore' 
  | 'finish' 
  | 'glass' 
  | 'rubber' 
  | 'metal' 
  | 'unknown';

export type ProfileRefType = 'svgText' | 'svgFile' | 'dxf' | 'estimated';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ProfileRef {
  type: ProfileRefType;
  svgText?: string;
  fileId?: string;
  meta?: {
    estimatedFrom?: string;
    confidence?: number;
    source?: string;
    [key: string]: any;
  };
}

export interface ResolvedComponentInstance {
  id: string;
  name: string;
  componentModelId: string; // e.g. "TJN - Door Stile", "Winkhaus AutoLock AV4"
  kind: ComponentKind;
  
  // Geometry in millimeters
  dimsMm: Vec3; // width/height/depth depending on kind
  posMm: Vec3;
  rotDeg: Vec3;
  
  // Keep original expressions for editing/back-propagation
  expr?: {
    dims?: Record<string, string>; // e.g. { x: "#stileW", y: "#ph", z: "#sd" }
    pos?: Record<string, string>;
    rot?: Record<string, string>;
  };
  
  // Profile reference (for extrusions)
  profileRef?: ProfileRef;
  
  // Material assignment
  materialRole: MaterialRole;
  materialKey?: string; // resolved preset/material id
  
  // Hardware-specific
  sku?: string;
  
  // Additional metadata
  meta?: {
    layer?: string;
    assembly?: string;
    visible?: boolean;
    selectable?: boolean;
    [key: string]: any;
  };
}

export interface ResolvedMaterialAssignment {
  role: MaterialRole;
  materialKey: string;
  name?: string;
  finish?: string;
  color?: string;
  meta?: any;
}

export interface ResolvedHardwareItem {
  id: string;
  name: string;
  sku: string;
  componentModelId: string;
  quantity: number;
  unitCost?: number;
  supplier?: string;
  meta?: any;
}

export interface BomLine {
  id: string;
  componentId: string;
  componentName: string;
  material: string;
  description: string;
  quantity: number;
  unit: string; // 'mm', 'm', 'm²', 'm³', 'ea', 'kg'
  unitCost?: number;
  totalCost?: number;
  supplier?: string;
  sku?: string;
  meta?: any;
}

export interface CutLine {
  id: string;
  componentId: string;
  componentName: string;
  profileId?: string;
  profileName?: string;
  material: string;
  lengthMm: number;
  widthMm?: number;
  thicknessMm?: number;
  quantity: number;
  cuttingAngleStart?: number;
  cuttingAngleEnd?: number;
  notes?: string;
  meta?: any;
}

export interface PricingSummary {
  subtotal: number;
  materials: number;
  hardware: number;
  finishing: number;
  labor?: number;
  markup?: number;
  tax?: number;
  total: number;
  currency: string;
  breakdown: {
    category: string;
    description: string;
    amount: number;
  }[];
}

export interface ResolvedProduct {
  templateId: string;
  name?: string;
  category?: string;
  
  // Global parameters (evaluated to numbers/strings/booleans)
  globals: Record<string, number | string | boolean>;
  
  // Component instances (all expressions resolved)
  instances: ResolvedComponentInstance[];
  
  // Material assignments
  materials: ResolvedMaterialAssignment[];
  
  // Hardware items
  hardware: ResolvedHardwareItem[];
  
  // Generated outputs
  bom: BomLine[];
  cutList: CutLine[];
  pricing: PricingSummary;
  
  // Feedback
  warnings: string[];
  questions: string[];
  
  // Metadata
  meta?: {
    createdAt?: string;
    updatedAt?: string;
    version?: string;
    [key: string]: any;
  };
}

// Template Draft Types (pre-resolution, from AI)

export interface TemplateGlobals {
  [key: string]: {
    value: number | string | boolean;
    unit?: string;
    description?: string;
    min?: number;
    max?: number;
  };
}

export interface TemplateInstance {
  id: string;
  name: string;
  componentModelId: string;
  kind: ComponentKind;
  
  // Expression-based dimensions
  dims: {
    x: string; // e.g. "#stileW" or "80" or "#pw - #stileW*2"
    y: string;
    z: string;
  };
  
  pos: {
    x: string;
    y: string;
    z: string;
  };
  
  rot?: {
    x: string;
    y: string;
    z: string;
  };
  
  profileRef?: {
    type: ProfileRefType;
    svgText?: string;
    fileId?: string;
    estimatedFrom?: string;
  };
  
  materialRole: MaterialRole;
  materialKey?: string;
  sku?: string;
  meta?: any;
}

export interface TemplateMaterialRule {
  role: MaterialRole;
  materialKey: string;
  condition?: string; // future: conditional logic
}

export interface TemplateDraft {
  templateId: string;
  name: string;
  category: string;
  
  globals: TemplateGlobals;
  instances: TemplateInstance[];
  materials: TemplateMaterialRule[];
  hardware: {
    id: string;
    name: string;
    sku: string;
    componentModelId: string;
    quantity: number | string; // can be expression
    position?: string; // expression
  }[];
  
  warnings: string[];
  questions: string[];
  
  meta?: any;
}
