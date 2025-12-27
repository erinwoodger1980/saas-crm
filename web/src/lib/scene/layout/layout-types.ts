export type LayoutRole =
  | 'stile'
  | 'rail'
  | 'panel'
  | 'glazing'
  | 'mullion'
  | 'transom'
  | 'sash'
  | 'frame';

export interface LayoutRect {
  x: number; // center X (mm)
  y: number; // center Y (mm)
  width: number; // mm
  height: number; // mm
}

export interface LayoutConstraint {
  axis: 'x' | 'y';
  min: number;
  max: number;
  step?: number;
}

export interface LayoutSlot {
  id: string;
  role: LayoutRole;
  rect: LayoutRect;
  depth: number;
  constraints?: LayoutConstraint[];
  slot?: string; // deterministic slot name for edits
}

export interface RailSlot {
  id: string;
  role: 'top' | 'bottom' | 'mid';
  y: number;
  height: number;
  minY: number;
  maxY: number;
}

export interface DoorLayout {
  width: number;
  height: number;
  depth: number;
  stileWidth: number;
  railSizes: {
    top: number;
    bottom: number;
    mid: number;
  };
  rails: RailSlot[];
  panels: LayoutSlot[];
  glazing: LayoutSlot[];
  mullions: LayoutSlot[];
  constraints: {
    railY: Record<string, LayoutConstraint>;
  };
}

export interface WindowLayout {
  width: number;
  height: number;
  depth: number;
  frameWidth: number;
  sashStileWidth: number;
  sashRailHeight: number;
  mullionWidth: number;
  transomHeight: number;
  sashes: LayoutSlot[];
  glazing: LayoutSlot[];
  mullions: LayoutSlot[];
  transoms: LayoutSlot[];
  constraints: {
    mullionX: Record<string, LayoutConstraint>;
    transomY: Record<string, LayoutConstraint>;
  };
}
