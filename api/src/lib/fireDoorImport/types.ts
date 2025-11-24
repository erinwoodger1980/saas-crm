/**
 * Fire Door Import Types
 * Types for CSV import of fire door orders
 */

export interface FireDoorImportRequest {
  sourceName: string;
  projectId?: string;
  orderId?: string;
}

export interface FireDoorImportSummary {
  id: string;
  totalValue: number;
  currency: string;
  status: string;
  rowCount: number;
  createdAt: Date;
}

export interface FireDoorLineItemPreview {
  id: string;
  doorRef: string | null;
  location: string | null;
  fireRating: string | null;
  quantity: number | null;
  lineTotal: number | null;
}

export interface FireDoorImportResponse {
  import: FireDoorImportSummary;
  lineItems: FireDoorLineItemPreview[];
  totalValue: number;
  rowCount: number;
}

/**
 * CSV Row Mapping
 * Maps CSV column headers to our internal field names
 */
export interface RawCSVRow {
  [header: string]: string;
}

export interface ParsedFireDoorRow {
  // Core fields
  itemType: string | null;
  code: string | null;
  quantity: number | null;

  // Door identification
  doorRef: string | null;
  location: string | null;
  doorSetType: string | null;
  fireRating: string | null;
  acousticRatingDb: number | null;
  handing: string | null;

  // Colors & finishes
  internalColour: string | null;
  externalColour: string | null;
  frameFinish: string | null;

  // Leaf geometry
  leafHeight: number | null;
  masterLeafWidth: number | null;
  slaveLeafWidth: number | null;
  leafThickness: number | null;
  leafConfiguration: string | null;
  ifSplitMasterSize: string | null;

  // Finishes & edges
  doorFinishSide1: string | null;
  doorFinishSide2: string | null;
  doorFacing: string | null;
  lippingFinish: string | null;
  doorEdgeProtType: string | null;
  doorEdgeProtPos: string | null;
  doorUndercut: string | null;
  doorUndercutMm: number | null;

  // Vision panels (Leaf 1)
  visionQtyLeaf1: number | null;
  vp1WidthLeaf1: number | null;
  vp1HeightLeaf1: number | null;
  vp2WidthLeaf1: number | null;
  vp2HeightLeaf1: number | null;

  // Vision panels (Leaf 2)
  visionQtyLeaf2: number | null;
  vp1WidthLeaf2: number | null;
  vp1HeightLeaf2: number | null;
  vp2WidthLeaf2: number | null;
  vp2HeightLeaf2: number | null;

  // Total glazing
  totalGlazedAreaMaster: number | null;
  fanlightSidelightGlz: string | null;
  glazingTape: string | null;

  // Ironmongery
  ironmongeryPackRef: string | null;
  closerOrFloorSpring: string | null;
  spindleFacePrep: string | null;
  cylinderFacePrep: string | null;
  flushBoltSupplyPrep: string | null;
  flushBoltQty: number | null;
  fingerProtection: string | null;
  fireSignage: string | null;
  fireSignageQty: number | null;
  fireSignageFactoryFit: string | null;
  fireIdDisc: string | null;
  fireIdDiscQty: number | null;
  doorViewer: string | null;
  doorViewerPosition: string | null;
  doorViewerPrepSize: string | null;
  doorChain: string | null;
  doorViewersQty: number | null;
  doorChainFactoryFit: string | null;
  doorViewersFactoryFit: string | null;

  // Additional notes
  additionNote1: string | null;
  additionNote1Qty: number | null;

  // Pricing
  unitValue: number | null;
  labourCost: number | null;
  materialCost: number | null;
  lineTotal: number | null;

  // Raw data for traceability
  rawRowJson: RawCSVRow;
}

/**
 * Column header mapping
 * Maps exact CSV column names to our field names
 */
export const COLUMN_MAPPING = {
  // Core fields
  'Item': 'itemType',
  'Code': 'code',
  'Quantity': 'quantity',

  // Door identification
  'Door Ref': 'doorRef',
  'Location': 'location',
  'Doorset / Leaf / Frame': 'doorSetType',
  'Fire Rating': 'fireRating',
  'Acoustic Rating dB': 'acousticRatingDb',
  'Handing': 'handing',

  // Colors & finishes
  'Internal Colour': 'internalColour',
  'External Colour': 'externalColour',
  'Frame Finish': 'frameFinish',

  // Leaf geometry
  'Leaf Height': 'leafHeight',
  'M Leaf Width': 'masterLeafWidth',
  'S Leaf Width': 'slaveLeafWidth',
  'Leaf Thickness': 'leafThickness',
  'Leaf Configuration': 'leafConfiguration',
  'If Split, Master Leaf Size': 'ifSplitMasterSize',

  // Finishes & edges
  'Door Finish - Side 1 (Push)': 'doorFinishSide1',
  'Door Finish - Side 2 (Pull)': 'doorFinishSide2',
  'Door Facing': 'doorFacing',
  'Lipping Finish': 'lippingFinish',
  'Door Edge Protection Type': 'doorEdgeProtType',
  'Door Edge Protection Position': 'doorEdgeProtPos',
  'Door Undercut': 'doorUndercut',
  'Door Undercut (mm)': 'doorUndercutMm',

  // Vision panels (Leaf 1)
  'Vision Panel Qty, Leaf 1': 'visionQtyLeaf1',
  'Leaf 1 Aperture 1 Width (See Size Detail)': 'vp1WidthLeaf1',
  'Leaf 1 Aperture 1 Height (See Size Detail)': 'vp1HeightLeaf1',
  'Leaf 1 Aperture 2 Width (See Size Detail)': 'vp2WidthLeaf1',
  'Leaf 1 Aperture 2 Height (See Size Detail)': 'vp2HeightLeaf1',

  // Vision panels (Leaf 2)
  'Vision Panel Qty, Leaf 2': 'visionQtyLeaf2',
  'Leaf 2 Cut Out Aperture 1 Width': 'vp1WidthLeaf2',
  'Leaf 2 Cut Out Aperture 1 Height': 'vp1HeightLeaf2',
  'Leaf 2 Cut Out Aperture 2 Width': 'vp2WidthLeaf2',
  'Leaf 2 Cut Out Aperture 2 Height': 'vp2HeightLeaf2',

  // Total glazing
  'Total Glazed Area Master Leaf (msq)': 'totalGlazedAreaMaster',
  'Fanlight/Sidelight Glazing': 'fanlightSidelightGlz',
  'Glazing Tape': 'glazingTape',

  // Ironmongery
  'Ironmongery Pack Ref': 'ironmongeryPackRef',
  'Closers / Floor Springs': 'closerOrFloorSpring',
  'Spindle Face Prep': 'spindleFacePrep',
  'Cylinder Face Prep': 'cylinderFacePrep',
  'Flush Bolt Supply/Prep': 'flushBoltSupplyPrep',
  'Flush Bolt Qty': 'flushBoltQty',
  'Finger Protection': 'fingerProtection',
  'Fire Signage': 'fireSignage',
  'Fire Signage Qty': 'fireSignageQty',
  'Factory Fit Fire Signage': 'fireSignageFactoryFit',
  'Fire ID Disc': 'fireIdDisc',
  'Fire ID Disc Qty': 'fireIdDiscQty',
  'Door Viewer': 'doorViewer',
  'Door Viewer Position': 'doorViewerPosition',
  'Door Viewer Prep Size': 'doorViewerPrepSize',
  'Door Chain': 'doorChain',
  'Door Viewers Qty': 'doorViewersQty',
  'Factory Fit Door Chain': 'doorChainFactoryFit',
  'Factory Fit Door Viewers': 'doorViewersFactoryFit',

  // Additional notes
  'Addition 1 / Note 1': 'additionNote1',
  'Addition 1 Qty': 'additionNote1Qty',

  // Pricing
  'Value': 'unitValue',
  'Cost of Labour': 'labourCost',
  'Cost of Materials': 'materialCost',
} as const;
