/**
 * Template: Ely – Hi-Performance Flush Window (Ovolo)
 *
 * This template is intentionally minimal and driven by the supplier cutlist "finish sizes".
 * It models only the members we can extract deterministically from the provided cutlist PDF.
 */

import type { TemplateDraft } from '@/types/resolved-product';

export const TEMPLATE_ID = 'window_ely_hp_flush_ovolo';

export const windowElyHiPerformanceFlushOvoloTemplate: TemplateDraft = {
  templateId: TEMPLATE_ID,
  name: 'Ely – Hi-Performance Flush Window (Ovolo)',
  category: 'windows',

  globals: {
    // Overall window dimensions
    pw: { value: 1800, unit: 'mm', description: 'Overall width' },
    ph: { value: 1070, unit: 'mm', description: 'Overall height' },

    // Cross-sections (mm) as per cutlist summary
    frameCrossX: { value: 96, unit: 'mm', description: 'Frame section (one axis)' },
    frameCrossZ: { value: 75, unit: 'mm', description: 'Frame section (other axis)' },

    jambCrossX: { value: 96, unit: 'mm', description: 'Jamb section (one axis)' },
    jambCrossZ: { value: 63, unit: 'mm', description: 'Jamb section (other axis)' },

    // Cutlist-derived finished lengths (shoulder/finish sizes)
    jambLen: { value: 1070, unit: 'mm', description: 'Jamb finished length' },
    headLen: { value: 1800, unit: 'mm', description: 'Head finished length' },
    cillLen: { value: 1800, unit: 'mm', description: 'Cill finished length' },
    transomLen: { value: 652, unit: 'mm', description: 'Transom finished length' },
    sashBottomRailLen: { value: 550.7, unit: 'mm', description: 'Sash bottom rail (incl. fanlight) finished length' },

    // Quantities (per window)
    jambQty: { value: 2, description: 'Two jambs per window' },
    sashBottomRailQty: { value: 3, description: 'Bottom rails per window (2 sashes + 1 fanlight)' },
  },

  instances: [
    // Frame members (finish sizes)
    {
      id: 'jamb_left',
      name: 'Jamb',
      componentModelId: 'Ely - Frame Member',
      kind: 'profileExtrusion',
      dims: {
        x: '#jambCrossX',
        y: '#jambLen',
        z: '#jambCrossZ',
      },
      pos: { x: '0', y: '#ph / 2', z: '0' },
      materialRole: 'timber',
      profileRef: { type: 'estimated', estimatedFrom: 'ely jamb' },
    },
    {
      id: 'jamb_right',
      name: 'Jamb',
      componentModelId: 'Ely - Frame Member',
      kind: 'profileExtrusion',
      dims: {
        x: '#jambCrossX',
        y: '#jambLen',
        z: '#jambCrossZ',
      },
      pos: { x: '#pw', y: '#ph / 2', z: '0' },
      materialRole: 'timber',
      profileRef: { type: 'estimated', estimatedFrom: 'ely jamb' },
    },
    {
      id: 'head',
      name: 'Head',
      componentModelId: 'Ely - Head',
      kind: 'profileExtrusion',
      dims: {
        x: '#frameCrossX',
        y: '#headLen',
        z: '#frameCrossZ',
      },
      pos: { x: '#pw / 2', y: '#ph', z: '0' },
      rot: { x: '0', y: '0', z: '90' },
      materialRole: 'timber',
      profileRef: { type: 'estimated', estimatedFrom: 'ely head' },
    },
    {
      id: 'cill',
      name: 'Cill',
      componentModelId: 'Ely - Cill',
      kind: 'profileExtrusion',
      dims: {
        x: '#frameCrossX',
        y: '#cillLen',
        z: '#frameCrossZ',
      },
      pos: { x: '#pw / 2', y: '0', z: '0' },
      rot: { x: '0', y: '0', z: '90' },
      materialRole: 'timber',
      profileRef: { type: 'estimated', estimatedFrom: 'ely cill' },
    },
    {
      id: 'transom',
      name: 'Transom',
      componentModelId: 'Ely - Frame Member',
      kind: 'profileExtrusion',
      dims: {
        x: '#frameCrossX',
        y: '#transomLen',
        z: '#frameCrossZ',
      },
      pos: { x: '#pw / 2', y: '#ph * 0.65', z: '0' },
      rot: { x: '0', y: '0', z: '90' },
      materialRole: 'timber',
      profileRef: { type: 'estimated', estimatedFrom: 'ely transom' },
    },

    // Sash bottom rails (finish sizes; grouped)
    {
      id: 'sash_bottom_1',
      name: 'Sash bottom rail (incl. fanlight)',
      componentModelId: 'Ely - Sash Member',
      kind: 'profileExtrusion',
      dims: {
        x: '63',
        y: '#sashBottomRailLen',
        z: '75',
      },
      pos: { x: '#pw / 2', y: '#ph * 0.35', z: '0' },
      rot: { x: '0', y: '0', z: '90' },
      materialRole: 'timber',
      profileRef: { type: 'estimated', estimatedFrom: 'ely sash bottom rail' },
    },
    {
      id: 'sash_bottom_2',
      name: 'Sash bottom rail (incl. fanlight)',
      componentModelId: 'Ely - Sash Member',
      kind: 'profileExtrusion',
      dims: {
        x: '63',
        y: '#sashBottomRailLen',
        z: '75',
      },
      pos: { x: '#pw / 2', y: '#ph * 0.30', z: '0' },
      rot: { x: '0', y: '0', z: '90' },
      materialRole: 'timber',
      profileRef: { type: 'estimated', estimatedFrom: 'ely sash bottom rail' },
    },
    {
      id: 'sash_bottom_3',
      name: 'Sash bottom rail (incl. fanlight)',
      componentModelId: 'Ely - Sash Member',
      kind: 'profileExtrusion',
      dims: {
        x: '63',
        y: '#sashBottomRailLen',
        z: '75',
      },
      pos: { x: '#pw / 2', y: '#ph * 0.25', z: '0' },
      rot: { x: '0', y: '0', z: '90' },
      materialRole: 'timber',
      profileRef: { type: 'estimated', estimatedFrom: 'ely sash bottom rail' },
    },
  ],

  materials: [
    { role: 'timber', materialKey: 'accoya-natural' },
    { role: 'finish', materialKey: 'painted-ral-9016' },
  ],

  hardware: [],

  warnings: [
    'Cutlist baseline is per-window; source PDF summarizes two identical windows (W1/W2).',
    'Template currently models a minimal subset of members extracted deterministically from the cutlist.',
  ],
  questions: [],

  meta: {
    source: 'docs/ely/Ely Cut list.pdf',
    finishSizes: true,
  },
};
