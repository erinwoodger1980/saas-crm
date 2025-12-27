import { ProductParams } from '@/types/parametric-builder';
import { DoorLayout, LayoutConstraint, LayoutSlot, RailSlot } from './layout-types';
import * as THREE from 'three';

const DOOR_LAYOUT_DEFAULTS = {
  thickness: 58,
  stileWidth: 114,
  topRail: 114,
  midRail: 200,
  bottomRail: 200,
  panelThickness: 18,
  glazingThickness: 24,
  beadWidth: 20,
  mouldingWidth: 25,
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

function resolvePanelGrid(params: ProductParams): { cols: number; rows: number } {
  const hintGrid = parsePanelGrid(params.construction?.layoutHint?.panelGrid);
  if (hintGrid) return hintGrid;

  const layout = params.construction?.panelLayout;
  if (layout?.cols && layout?.rows) {
    return {
      cols: Math.max(1, layout.cols),
      rows: Math.max(1, layout.rows),
    };
  }

  switch (params.productType.option) {
    case 'E02':
      return { cols: 2, rows: 2 };
    case 'E01':
    default:
      return { cols: 1, rows: 2 };
  }
}

function buildRailConstraint(minY: number, maxY: number): LayoutConstraint {
  return { axis: 'y', min: minY, max: maxY, step: 1 };
}

export function resolveDoorLayout(params: ProductParams): DoorLayout {
  const width = clampNumber(safeNumber(params.dimensions?.width, 914), 500, 3000);
  const height = clampNumber(safeNumber(params.dimensions?.height, 2032), 1500, 3000);
  const depth = clampNumber(safeNumber(params.dimensions?.depth, DOOR_LAYOUT_DEFAULTS.thickness), 35, 100);

  const construction = params.construction || {};
  const stileWidth = clampNumber(safeNumber(construction.stileWidth, DOOR_LAYOUT_DEFAULTS.stileWidth), 50, 200);
  const topRail = clampNumber(safeNumber(construction.topRail, DOOR_LAYOUT_DEFAULTS.topRail), 50, 300);
  const midRail = clampNumber(safeNumber(construction.midRail, DOOR_LAYOUT_DEFAULTS.midRail), 50, 300);
  const bottomRail = clampNumber(safeNumber(construction.bottomRail, DOOR_LAYOUT_DEFAULTS.bottomRail), 50, 300);

  const overrides = construction.layoutOverrides || {};
  const hintRails = construction.layoutHint?.railHeightsHints;
  const minSpacing = 80;

  const topDefault = height - topRail / 2;
  const bottomDefault = bottomRail / 2;

  let bottomRailY = overrides.bottomRailY ?? hintRails?.bottom ?? bottomDefault;
  bottomRailY = THREE.MathUtils.clamp(bottomRailY, bottomRail / 2, height - bottomRail / 2);

  let topRailY = overrides.topRailY ?? hintRails?.top ?? topDefault;
  topRailY = THREE.MathUtils.clamp(topRailY, topRail / 2, height - topRail / 2);

  if (topRailY - topRail / 2 < bottomRailY + bottomRail / 2 + minSpacing) {
    topRailY = bottomRailY + bottomRail / 2 + minSpacing + topRail / 2;
    topRailY = Math.min(topRailY, height - topRail / 2);
  }

  if (bottomRailY + bottomRail / 2 > topRailY - topRail / 2 - minSpacing) {
    bottomRailY = Math.max(bottomRail / 2, topRailY - topRail / 2 - minSpacing - bottomRail / 2);
  }

  const midDefault = (bottomRailY + topRailY) / 2;
  const midMin = bottomRailY + bottomRail / 2 + minSpacing;
  const midMax = topRailY - topRail / 2 - minSpacing;
  let midRailY = overrides.midRailY ?? hintRails?.mid ?? midDefault;
  midRailY = THREE.MathUtils.clamp(midRailY, midMin, midMax);

  const railYById: Record<string, number> = { ...(overrides.railYById || {}) };
  Object.keys(railYById).forEach((id) => {
    railYById[id] = THREE.MathUtils.clamp(railYById[id], midMin, midMax);
  });

  const rails: RailSlot[] = [
    {
      id: 'topRail',
      role: 'top',
      y: topRailY,
      height: topRail,
      minY: midMin,
      maxY: height - topRail / 2,
    },
    {
      id: 'bottomRail',
      role: 'bottom',
      y: bottomRailY,
      height: bottomRail,
      minY: bottomRail / 2,
      maxY: midMax,
    },
  ];

  const panelGrid = resolvePanelGrid(params);
  const panelSlots: LayoutSlot[] = [];
  const glazingSlots: LayoutSlot[] = [];

  const topBoundary = topRailY - topRail / 2;
  const bottomBoundary = bottomRailY + bottomRail / 2;
  const panelAreaWidth = width - 2 * stileWidth;

  if (params.productType.option === 'E03' || params.construction?.layoutHint?.glazedTopPct) {
    const glazedTopPct = clampNumber(
      safeNumber(construction.layoutHint?.glazedTopPct, construction.glazingArea?.topPercent ?? 35),
      10,
      80
    );

    const areaHeight = topBoundary - bottomBoundary - midRail;
    const glazedHeight = areaHeight * (glazedTopPct / 100);
    const panelHeight = areaHeight - glazedHeight;

    const glazedCenterY = topBoundary - glazedHeight / 2;

    glazingSlots.push({
      id: 'glazing_top',
      role: 'glazing',
      rect: {
        x: 0,
        y: glazedCenterY,
        width: panelAreaWidth,
        height: glazedHeight,
      },
      depth: depth,
      slot: 'glazing_top',
    });

    const midRailId = 'midRail_glazing';
    const midRailYResolved = railYById[midRailId] ?? midRailY ?? (topBoundary - glazedHeight - midRail / 2);

    rails.push({
      id: midRailId,
      role: 'mid',
      y: midRailYResolved,
      height: midRail,
      minY: midMin,
      maxY: midMax,
    });

    const panelAreaYEnd = bottomBoundary + panelHeight;
    const panelCenterY = bottomBoundary + panelHeight / 2;
    const cols = 2;
    const rows = 1;
    const panelWidth = panelAreaWidth / cols;
    const panelHeightEach = panelHeight / rows;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const id = `panel_r${row + 1}c${col + 1}`;
        panelSlots.push({
          id,
          role: 'panel',
          rect: {
            x: -panelAreaWidth / 2 + col * panelWidth + panelWidth / 2,
            y: panelCenterY,
            width: panelWidth,
            height: panelHeightEach,
          },
          depth: depth,
          slot: id,
        });
      }
    }
  } else {
    const cols = panelGrid.cols;
    const rows = panelGrid.rows;
    const panelAreaHeight = topBoundary - bottomBoundary - (rows - 1) * midRail;
    const panelWidth = panelAreaWidth / cols;
    const panelHeight = panelAreaHeight / rows;

    const panelAreaYEnd = topBoundary;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const id = `panel_r${row + 1}c${col + 1}`;
        panelSlots.push({
          id,
          role: 'panel',
          rect: {
            x: -panelAreaWidth / 2 + col * panelWidth + panelWidth / 2,
            y: panelAreaYEnd - row * panelHeight - panelHeight / 2,
            width: panelWidth,
            height: panelHeight,
          },
          depth: depth,
          slot: id,
        });
      }
    }

    if (rows > 1) {
      for (let i = 0; i < rows - 1; i++) {
        const defaultRailY = panelAreaYEnd - (i + 1) * panelHeight - i * midRail - midRail / 2;
        const railId = `midRail_${i + 1}`;
        const railY = railYById[railId] ?? midRailY ?? defaultRailY;
        rails.push({
          id: railId,
          role: 'mid',
          y: railY,
          height: midRail,
          minY: midMin,
          maxY: midMax,
        });
      }
    }
  }

  const constraints: Record<string, LayoutConstraint> = {};
  rails.forEach((rail) => {
    constraints[rail.id] = buildRailConstraint(rail.minY, rail.maxY);
  });

  return {
    width,
    height,
    depth,
    stileWidth,
    railSizes: {
      top: topRail,
      bottom: bottomRail,
      mid: midRail,
    },
    rails,
    panels: panelSlots,
    glazing: glazingSlots,
    mullions: [],
    constraints: {
      railY: constraints,
    },
  };
}
