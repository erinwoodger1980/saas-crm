import { ProductParams } from '@/types/parametric-builder';
import { LayoutConstraint, LayoutSlot, WindowLayout } from './layout-types';

const WINDOW_LAYOUT_DEFAULTS = {
  frameDepth: 100,
  sashDepth: 68,
  frameWidth: 68,
  sashStileWidth: 58,
  sashRailHeight: 58,
  mullionWidth: 68,
  transomHeight: 68,
  glazingThickness: 24,
};

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value: any, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parsePanelGrid(grid?: string): { cols: number; rows: number } | null {
  if (!grid) return null;
  const match = grid.trim().match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) return null;
  const cols = Number(match[1]);
  const rows = Number(match[2]);
  if (!Number.isFinite(cols) || !Number.isFinite(rows)) return null;
  return { cols: Math.max(1, cols), rows: Math.max(1, rows) };
}

function buildConstraint(axis: 'x' | 'y', min: number, max: number): LayoutConstraint {
  return { axis, min, max, step: 1 };
}

export function resolveWindowLayout(params: ProductParams): WindowLayout {
  const width = clampNumber(safeNumber(params.dimensions?.width, 1200), 400, 4000);
  const height = clampNumber(safeNumber(params.dimensions?.height, 1200), 400, 4000);
  const depth = clampNumber(safeNumber(params.dimensions?.depth, WINDOW_LAYOUT_DEFAULTS.frameDepth), 40, 200);

  const construction = params.construction || {};
  const frameWidth = clampNumber(safeNumber(construction.frameWidth, WINDOW_LAYOUT_DEFAULTS.frameWidth), 40, 150);
  const sashStileWidth = clampNumber(safeNumber(construction.sashStileWidth, WINDOW_LAYOUT_DEFAULTS.sashStileWidth), 30, 120);
  const sashRailHeight = clampNumber(safeNumber(construction.sashRailHeight, WINDOW_LAYOUT_DEFAULTS.sashRailHeight), 30, 120);
  const mullionWidth = clampNumber(safeNumber(construction.mullionWidth, WINDOW_LAYOUT_DEFAULTS.mullionWidth), 40, 150);
  const transomHeight = clampNumber(safeNumber(construction.transomHeight, WINDOW_LAYOUT_DEFAULTS.transomHeight), 40, 150);

  const gridHint = parsePanelGrid(construction.layoutHint?.panelGrid) || parsePanelGrid(params.productType.option);
  const layout = construction.layout || {};

  const cols = gridHint?.cols ?? Math.max(1, (layout.mullions ?? 0) + 1);
  const rows = gridHint?.rows ?? Math.max(1, (layout.transoms ?? 0) + 1);

  const mullions = Math.max(0, cols - 1);
  const transoms = Math.max(0, rows - 1);

  const availableWidth = width - 2 * frameWidth - mullions * mullionWidth;
  const availableHeight = height - 2 * frameWidth - transoms * transomHeight;

  const sashWidth = availableWidth / cols;
  const sashHeight = availableHeight / rows;

  const sashes: LayoutSlot[] = [];
  const glazing: LayoutSlot[] = [];
  const mullionSlots: LayoutSlot[] = [];
  const transomSlots: LayoutSlot[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = `sash_r${row + 1}c${col + 1}`;
      const x = -width / 2 + frameWidth + col * (sashWidth + mullionWidth) + sashWidth / 2;
      const y = height / 2 - frameWidth - row * (sashHeight + transomHeight) - sashHeight / 2;

      sashes.push({
        id,
        role: 'sash',
        rect: {
          x,
          y,
          width: sashWidth,
          height: sashHeight,
        },
        depth,
        slot: id,
      });

      glazing.push({
        id: `${id}_glazing`,
        role: 'glazing',
        rect: {
          x,
          y,
          width: sashWidth - 2 * sashStileWidth,
          height: sashHeight - 2 * sashRailHeight,
        },
        depth,
        slot: `${id}_glazing`,
      });
    }
  }

  for (let i = 0; i < mullions; i++) {
    const x = -width / 2 + frameWidth + (i + 1) * sashWidth + i * mullionWidth + mullionWidth / 2;
    mullionSlots.push({
      id: `mullion_${i + 1}`,
      role: 'mullion',
      rect: {
        x,
        y: 0,
        width: mullionWidth,
        height: height - 2 * frameWidth,
      },
      depth,
      slot: `mullion_${i + 1}`,
    });
  }

  for (let i = 0; i < transoms; i++) {
    const y = height / 2 - frameWidth - (i + 1) * sashHeight - i * transomHeight - transomHeight / 2;
    transomSlots.push({
      id: `transom_${i + 1}`,
      role: 'transom',
      rect: {
        x: 0,
        y,
        width: width - 2 * frameWidth,
        height: transomHeight,
      },
      depth,
      slot: `transom_${i + 1}`,
    });
  }

  const mullionConstraints: Record<string, LayoutConstraint> = {};
  mullionSlots.forEach((slot) => {
    const min = -width / 2 + frameWidth + mullionWidth / 2 + 50;
    const max = width / 2 - frameWidth - mullionWidth / 2 - 50;
    mullionConstraints[slot.id] = buildConstraint('x', min, max);
  });

  const transomConstraints: Record<string, LayoutConstraint> = {};
  transomSlots.forEach((slot) => {
    const min = -height / 2 + frameWidth + transomHeight / 2 + 50;
    const max = height / 2 - frameWidth - transomHeight / 2 - 50;
    transomConstraints[slot.id] = buildConstraint('y', min, max);
  });

  return {
    width,
    height,
    depth,
    frameWidth,
    sashStileWidth,
    sashRailHeight,
    mullionWidth,
    transomHeight,
    sashes,
    glazing,
    mullions: mullionSlots,
    transoms: transomSlots,
    constraints: {
      mullionX: mullionConstraints,
      transomY: transomConstraints,
    },
  };
}
