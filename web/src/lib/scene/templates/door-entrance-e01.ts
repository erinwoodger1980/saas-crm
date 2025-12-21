/**
 * Template: Entrance Door E01
 * 
 * Traditional timber entrance door with:
 * - 2 stiles (left/right)
 * - 3-4 rails (top, mid, bottom, optional glazing rail)
 * - Panels (solid timber or veneered MDF)
 * - Optional glazing with cassette
 * - Bolection moldings (decorative beads)
 * - Weatherboard (bottom external)
 * - Seals (perimeter)
 * - Lock + handle hardware
 * - Threshold/cill
 */

import type { TemplateDraft } from '@/types/resolved-product';

export const TEMPLATE_ID = 'door_entrance_e01';

export const doorEntranceE01Template: TemplateDraft = {
  templateId: TEMPLATE_ID,
  name: 'Entrance Door - Traditional',
  category: 'doors',
  
  globals: {
    // Overall dimensions
    pw: { value: 926, unit: 'mm', description: 'Product width (overall)' },
    ph: { value: 2032, unit: 'mm', description: 'Product height (overall)' },
    pd: { value: 54, unit: 'mm', description: 'Product depth (thickness)' },
    
    // Stile dimensions
    stileW: { value: 115, unit: 'mm', description: 'Stile width' },
    stileD: { value: 54, unit: 'mm', description: 'Stile depth' },
    
    // Rail dimensions
    topRailH: { value: 200, unit: 'mm', description: 'Top rail height' },
    midRailH: { value: 150, unit: 'mm', description: 'Middle rail height' },
    bottomRailH: { value: 250, unit: 'mm', description: 'Bottom rail height' },
    railD: { value: 54, unit: 'mm', description: 'Rail depth' },
    
    // Mullion (vertical center divider for glazing)
    hasMullion: { value: false, description: 'Include vertical mullion' },
    mullionW: { value: 60, unit: 'mm', description: 'Mullion width' },
    
    // Panel configuration
    panelThickness: { value: 20, unit: 'mm', description: 'Panel thickness' },
    panelInset: { value: 12, unit: 'mm', description: 'Panel inset from face' },
    
    // Glazing
    hasGlazing: { value: true, description: 'Include glazing section' },
    glazingRailH: { value: 100, unit: 'mm', description: 'Glazing cassette rail height' },
    glassThickness: { value: 6, unit: 'mm', description: 'Glass thickness' },
    
    // Bolection molding
    hasBolection: { value: true, description: 'Add bolection moldings' },
    bolectionW: { value: 28, unit: 'mm', description: 'Bolection width' },
    bolectionH: { value: 18, unit: 'mm', description: 'Bolection height (projection)' },
    
    // Weatherboard
    weatherboardH: { value: 85, unit: 'mm', description: 'Weatherboard height' },
    weatherboardProjection: { value: 45, unit: 'mm', description: 'Weatherboard projection' },
    
    // Seals
    sealSize: { value: 10, unit: 'mm', description: 'Seal width/height' },
    
    // Hardware positions
    lockHeight: { value: 1050, unit: 'mm', description: 'Lock center height from bottom' },
    handleHeight: { value: 1050, unit: 'mm', description: 'Handle center height from bottom' },
    
    // Threshold
    thresholdH: { value: 35, unit: 'mm', description: 'Threshold height' },
    thresholdW: { value: 70, unit: 'mm', description: 'Threshold width' },
  },
  
  instances: [
    // ==== STILES ====
    {
      id: 'stile_left',
      name: 'Left Stile',
      componentModelId: 'TJN - Door Stile',
      kind: 'profileExtrusion',
      dims: {
        x: '#stileW',
        y: '#ph',
        z: '#stileD',
      },
      pos: {
        x: '0',
        y: '#ph / 2',
        z: '0',
      },
      materialRole: 'timber',
      profileRef: {
        type: 'estimated',
        estimatedFrom: 'rectangular stile',
      },
    },
    {
      id: 'stile_right',
      name: 'Right Stile',
      componentModelId: 'TJN - Door Stile',
      kind: 'profileExtrusion',
      dims: {
        x: '#stileW',
        y: '#ph',
        z: '#stileD',
      },
      pos: {
        x: '#pw - #stileW',
        y: '#ph / 2',
        z: '0',
      },
      materialRole: 'timber',
      profileRef: {
        type: 'estimated',
        estimatedFrom: 'rectangular stile',
      },
    },
    
    // ==== RAILS ====
    {
      id: 'rail_top',
      name: 'Top Rail',
      componentModelId: 'TJN - Door Rail',
      kind: 'profileExtrusion',
      dims: {
        x: '#pw - #stileW * 2',
        y: '#topRailH',
        z: '#railD',
      },
      pos: {
        x: '#stileW',
        y: '#ph - #topRailH / 2',
        z: '0',
      },
      materialRole: 'timber',
      profileRef: {
        type: 'estimated',
        estimatedFrom: 'rectangular rail',
      },
    },
    {
      id: 'rail_mid',
      name: 'Middle Rail',
      componentModelId: 'TJN - Door Rail',
      kind: 'profileExtrusion',
      dims: {
        x: '#pw - #stileW * 2',
        y: '#midRailH',
        z: '#railD',
      },
      pos: {
        x: '#stileW',
        y: '#ph / 2',
        z: '0',
      },
      materialRole: 'timber',
      profileRef: {
        type: 'estimated',
        estimatedFrom: 'rectangular rail',
      },
    },
    {
      id: 'rail_bottom',
      name: 'Bottom Rail',
      componentModelId: 'TJN - Door Rail',
      kind: 'profileExtrusion',
      dims: {
        x: '#pw - #stileW * 2',
        y: '#bottomRailH',
        z: '#railD',
      },
      pos: {
        x: '#stileW',
        y: '#bottomRailH / 2',
        z: '0',
      },
      materialRole: 'timber',
      profileRef: {
        type: 'estimated',
        estimatedFrom: 'rectangular rail',
      },
    },
    
    // ==== GLAZING RAIL (conditional) ====
    {
      id: 'rail_glazing',
      name: 'Glazing Cassette Rail',
      componentModelId: 'TJN - Door Glazing Rail',
      kind: 'profileExtrusion',
      dims: {
        x: '#pw - #stileW * 2',
        y: '#glazingRailH',
        z: '#railD',
      },
      pos: {
        x: '#stileW',
        y: '#ph - #topRailH - #glazingRailH / 2',
        z: '0',
      },
      materialRole: 'timber',
      profileRef: {
        type: 'estimated',
        estimatedFrom: 'glazing cassette rail',
      },
      meta: {
        visible: '#hasGlazing',
      },
    },
    
    // ==== PANELS ====
    {
      id: 'panel_bottom',
      name: 'Bottom Panel',
      componentModelId: 'Panel - Solid Timber',
      kind: 'panel',
      dims: {
        x: '#pw - #stileW * 2 - #panelInset * 2',
        y: '#ph / 2 - #midRailH - #bottomRailH - #panelInset * 2',
        z: '#panelThickness',
      },
      pos: {
        x: '#stileW + #panelInset',
        y: '#bottomRailH + (#ph / 2 - #midRailH - #bottomRailH) / 2',
        z: '-#pd / 2 + #panelInset + #panelThickness / 2',
      },
      materialRole: 'panelCore',
      meta: {
        rounded: true,
        radius: 5,
      },
    },
    
    // ==== GLAZING (conditional) ====
    {
      id: 'glass_upper',
      name: 'Upper Glazing',
      componentModelId: 'Glass - Clear',
      kind: 'glass',
      dims: {
        x: '#pw - #stileW * 2 - #panelInset * 4',
        y: '#ph - #topRailH - #glazingRailH - #midRailH - #panelInset * 2',
        z: '#glassThickness',
      },
      pos: {
        x: '#stileW + #panelInset * 2',
        y: '#midRailH + (#ph - #topRailH - #glazingRailH - #midRailH) / 2',
        z: '0',
      },
      materialRole: 'glass',
      materialKey: 'clear-glass',
      meta: {
        visible: '#hasGlazing',
      },
    },
    
    // ==== BOLECTION MOLDINGS (decorative beads) ====
    {
      id: 'bolection_bottom_panel',
      name: 'Bolection - Bottom Panel',
      componentModelId: 'Bolection Molding',
      kind: 'profileExtrusion',
      dims: {
        x: '#bolectionW',
        y: '(#pw - #stileW * 2 + #ph / 2 - #midRailH - #bottomRailH) * 2',
        z: '#bolectionH',
      },
      pos: {
        x: '#stileW',
        y: '#bottomRailH + (#ph / 2 - #midRailH - #bottomRailH) / 2',
        z: '#pd / 2 + #bolectionH / 2',
      },
      materialRole: 'timber',
      profileRef: {
        type: 'estimated',
        estimatedFrom: 'bolection profile',
      },
      meta: {
        visible: '#hasBolection',
        assembly: 'perimeter_bead',
      },
    },
    
    // ==== WEATHERBOARD (external bottom) ====
    {
      id: 'weatherboard',
      name: 'Weatherboard',
      componentModelId: 'Weatherboard - Hardwood',
      kind: 'profileExtrusion',
      dims: {
        x: '#pw + #weatherboardProjection * 2',
        y: '#weatherboardH',
        z: '#weatherboardProjection',
      },
      pos: {
        x: '-#weatherboardProjection',
        y: '-#weatherboardH / 2',
        z: '-#pd / 2 - #weatherboardProjection / 2',
      },
      materialRole: 'timber',
      profileRef: {
        type: 'estimated',
        estimatedFrom: 'weatherboard profile',
      },
    },
    
    // ==== SEALS ====
    {
      id: 'seal_top',
      name: 'Top Seal',
      componentModelId: 'Seal - Rubber',
      kind: 'seal',
      dims: {
        x: '#pw',
        y: '#sealSize',
        z: '#sealSize',
      },
      pos: {
        x: '0',
        y: '#ph',
        z: '0',
      },
      materialRole: 'rubber',
      materialKey: 'rubber-black',
    },
    {
      id: 'seal_left',
      name: 'Left Seal',
      componentModelId: 'Seal - Rubber',
      kind: 'seal',
      dims: {
        x: '#sealSize',
        y: '#ph',
        z: '#sealSize',
      },
      pos: {
        x: '-#sealSize / 2',
        y: '#ph / 2',
        z: '0',
      },
      materialRole: 'rubber',
      materialKey: 'rubber-black',
    },
    {
      id: 'seal_right',
      name: 'Right Seal',
      componentModelId: 'Seal - Rubber',
      kind: 'seal',
      dims: {
        x: '#sealSize',
        y: '#ph',
        z: '#sealSize',
      },
      pos: {
        x: '#pw + #sealSize / 2',
        y: '#ph / 2',
        z: '0',
      },
      materialRole: 'rubber',
      materialKey: 'rubber-black',
    },
    
    // ==== THRESHOLD ====
    {
      id: 'threshold',
      name: 'Threshold',
      componentModelId: 'Threshold - Hardwood',
      kind: 'profileExtrusion',
      dims: {
        x: '#pw + #thresholdW',
        y: '#thresholdH',
        z: '#thresholdW',
      },
      pos: {
        x: '-#thresholdW / 2',
        y: '-#thresholdH / 2',
        z: '-#thresholdW / 2',
      },
      materialRole: 'timber',
      profileRef: {
        type: 'estimated',
        estimatedFrom: 'threshold profile',
      },
    },
  ],
  
  materials: [
    { role: 'timber', materialKey: 'oak-natural' },
    { role: 'panelCore', materialKey: 'oak-veneered-ply' },
    { role: 'glass', materialKey: 'clear-glass' },
    { role: 'rubber', materialKey: 'rubber-black' },
    { role: 'metal', materialKey: 'polished-chrome' },
  ],
  
  hardware: [
    {
      id: 'lock_multipoint',
      name: 'Winkhaus AutoLock AV4',
      sku: 'WIN-AL-AV4-92',
      componentModelId: 'Winkhaus AutoLock AV4',
      quantity: 1,
      position: '#lockHeight',
    },
    {
      id: 'handle_lever',
      name: 'Lever Handle - Chrome',
      sku: 'HND-LVR-CHR-001',
      componentModelId: 'Door Handle - Lever',
      quantity: 1,
      position: '#handleHeight',
    },
    {
      id: 'hinges',
      name: 'Butt Hinges 100mm - Stainless Steel',
      sku: 'HNG-BUT-SS-100',
      componentModelId: 'Butt Hinge',
      quantity: 3,
    },
  ],
  
  warnings: [],
  questions: [],
  
  meta: {
    version: '1.0',
    author: 'JoineryAI',
    created: '2025-12-21',
  },
};
