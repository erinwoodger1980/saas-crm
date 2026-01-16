/**
 * Ely F47 cutlist-derived component definitions.
 *
 * Source: docs/ely/Ely Cut list.pdf
 * Baseline extraction: docs/ely/ely-cutlist-baseline-1800x1070.json
 *
 * This is intentionally hard-coded so production seeding does not depend on
 * reading PDFs from disk at runtime.
 */

export type ElyF47CutlistItem = {
  kind: 'jamb' | 'head' | 'cill' | 'transom' | 'sash_bottom_rail';
  name: string;
  section: string; // e.g. "96x63"
  shoulderLengthMm: number;
  roughLengthMm: number;
  quantity: number; // per window
  codeStem: string; // stable, used to build ComponentLookup.code
};

export const ELY_F47_CUTLIST_ITEMS: ElyF47CutlistItem[] = [
  {
    kind: 'jamb',
    name: 'Jamb',
    section: '96x63',
    shoulderLengthMm: 1070,
    roughLengthMm: 1120,
    quantity: 2,
    codeStem: 'JAMB',
  },
  {
    kind: 'head',
    name: 'Head',
    section: '96x75',
    shoulderLengthMm: 1800,
    roughLengthMm: 1850,
    quantity: 1,
    codeStem: 'HEAD',
  },
  {
    kind: 'cill',
    name: 'Cill',
    section: '96x75',
    shoulderLengthMm: 1800,
    roughLengthMm: 1850,
    quantity: 1,
    codeStem: 'CILL',
  },
  {
    kind: 'transom',
    name: 'Transom',
    section: '96x75',
    shoulderLengthMm: 652,
    roughLengthMm: 702,
    quantity: 1,
    codeStem: 'TRANSOM',
  },
  {
    kind: 'sash_bottom_rail',
    name: 'Sash bottom rail (incl. fanlight)',
    section: '63x75',
    shoulderLengthMm: 550.7,
    roughLengthMm: 600,
    quantity: 3,
    codeStem: 'SASH_BOTTOM_RAIL',
  },
];
