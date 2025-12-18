/**
 * Curve Editor Component
 * Inspector panel UI for editing curve definitions
 * Supports arc, ellipse, bezier, polyline, spline with joinery presets
 */

'use client';

import { useMemo, useState } from 'react';
import {
  CurveDefinition,
  CurvePreset,
  EditableAttribute,
} from '@/types/parametric-builder';
import {
  segmentalArchToCurve,
  radiusHeadToCurve,
  gothicArchToCurve,
} from '@/lib/scene/curve-utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface CurveEditorProps {
  curve: CurveDefinition;
  onCurveChange?: (curve: CurveDefinition) => void;
}

/**
 * Editable curve preset section
 * Shows arc/ellipse/bezier parameters based on curve type
 */
function CurveTypeEditor({
  curve,
  onCurveChange,
}: {
  curve: CurveDefinition;
  onCurveChange?: (curve: CurveDefinition) => void;
}) {
  const handleArcChange = (field: string, value: any) => {
    if (!onCurveChange) return;

    const arc = curve.arc || {
      cx: 0,
      cy: 0,
      r: 100,
      startAngle: 0,
      endAngle: Math.PI,
    };

    onCurveChange({
      ...curve,
      arc: {
        ...arc,
        [field]: typeof value === 'string' ? parseFloat(value) : value,
      },
    });
  };

  const handleEllipseChange = (field: string, value: any) => {
    if (!onCurveChange) return;

    const ellipse = curve.ellipse || {
      cx: 0,
      cy: 0,
      rx: 100,
      ry: 50,
      rotation: 0,
    };

    onCurveChange({
      ...curve,
      ellipse: {
        ...ellipse,
        [field]: typeof value === 'string' ? parseFloat(value) : value,
      },
    });
  };

  const handleBezierChange = (pointIdx: number, coord: number, value: any) => {
    if (!onCurveChange) return;

    const bezier = curve.bezier || {
      p0: [0, 0],
      p1: [50, 50],
      p2: [100, 50],
      p3: [150, 0],
    };

    const points: any = {
      p0: bezier.p0,
      p1: bezier.p1,
      p2: bezier.p2,
      p3: bezier.p3,
    };

    const pointKey = `p${pointIdx}`;
    const newPoint = [...points[pointKey]];
    newPoint[coord] = parseFloat(value);
    points[pointKey] = newPoint;

    onCurveChange({
      ...curve,
      bezier: points,
    });
  };

  switch (curve.type) {
    case 'arc': {
      const arc = curve.arc || {
        cx: 0,
        cy: 0,
        r: 100,
        startAngle: 0,
        endAngle: Math.PI,
      };

      return (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Center X</Label>
              <Input
                type="number"
                value={arc.cx}
                onChange={(e) => handleArcChange('cx', e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label>Center Y</Label>
              <Input
                type="number"
                value={arc.cy}
                onChange={(e) => handleArcChange('cy', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div>
            <Label>Radius (mm)</Label>
            <Input
              type="number"
              value={arc.r}
              onChange={(e) => handleArcChange('r', e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Angle (rad)</Label>
              <Input
                type="number"
                step="0.1"
                value={arc.startAngle}
                onChange={(e) => handleArcChange('startAngle', e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label>End Angle (rad)</Label>
              <Input
                type="number"
                step="0.1"
                value={arc.endAngle}
                onChange={(e) => handleArcChange('endAngle', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      );
    }

    case 'ellipse': {
      const ellipse = curve.ellipse || {
        cx: 0,
        cy: 0,
        rx: 100,
        ry: 50,
      };

      return (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Center X</Label>
              <Input
                type="number"
                value={ellipse.cx}
                onChange={(e) => handleEllipseChange('cx', e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label>Center Y</Label>
              <Input
                type="number"
                value={ellipse.cy}
                onChange={(e) => handleEllipseChange('cy', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Radius X (mm)</Label>
              <Input
                type="number"
                value={ellipse.rx}
                onChange={(e) => handleEllipseChange('rx', e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label>Radius Y (mm)</Label>
              <Input
                type="number"
                value={ellipse.ry}
                onChange={(e) => handleEllipseChange('ry', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      );
    }

    case 'bezier': {
      const bezier = curve.bezier || {
        p0: [0, 0],
        p1: [50, 50],
        p2: [100, 50],
        p3: [150, 0],
      };

      return (
        <div className="space-y-4 p-4">
          <div className="text-xs text-muted-foreground">
            Control points (advanced - edit with care)
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={`p${i}`} className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">P{i} X</Label>
                <Input
                  type="number"
                  step="1"
                  value={bezier[`p${i}` as keyof typeof bezier][0]}
                  onChange={(e) => handleBezierChange(i, 0, e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-xs">P{i} Y</Label>
                <Input
                  type="number"
                  step="1"
                  value={bezier[`p${i}` as keyof typeof bezier][1]}
                  onChange={(e) => handleBezierChange(i, 1, e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>
          ))}
        </div>
      );
    }

    default:
      return <div className="p-4 text-sm text-muted-foreground">Curve type not editable</div>;
  }
}

/**
 * Joinery-friendly preset editor
 * Segmental arch, radius head, gothic arch
 */
function CurvePresetEditor({
  curve,
  onCurveChange,
}: {
  curve: CurveDefinition;
  onCurveChange?: (curve: CurveDefinition) => void;
}) {
  const [presetType, setPresetType] = useState<'segmentalArch' | 'radiusHead' | 'gothicArch'>(
    'segmentalArch'
  );

  const [presetValues, setPresetValues] = useState({
    span: 1000,
    rise: 300,
    radius: 500,
    springLineHeight: 200,
    apexHeight: 400,
    shoulderRadius: 300,
  });

  const handlePresetApply = () => {
    if (!onCurveChange) return;

    let newCurve: CurveDefinition;

    switch (presetType) {
      case 'segmentalArch':
        newCurve = segmentalArchToCurve(presetValues.span, presetValues.rise);
        break;
      case 'radiusHead':
        newCurve = radiusHeadToCurve(
          presetValues.radius,
          presetValues.springLineHeight,
          presetValues.span
        );
        break;
      case 'gothicArch':
        newCurve = gothicArchToCurve(
          presetValues.span,
          presetValues.apexHeight,
          presetValues.shoulderRadius
        );
        break;
    }

    onCurveChange(newCurve);
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <Label>Preset Type</Label>
        <Select value={presetType} onValueChange={(v: any) => setPresetType(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="segmentalArch">Segmental Arch</SelectItem>
            <SelectItem value="radiusHead">Radius Head</SelectItem>
            <SelectItem value="gothicArch">Gothic Arch</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {presetType === 'segmentalArch' && (
        <>
          <div>
            <Label>Span (mm)</Label>
            <Slider
              min={500}
              max={3000}
              step={50}
              value={[presetValues.span]}
              onValueChange={([v]) => setPresetValues({ ...presetValues, span: v })}
            />
            <div className="text-xs text-muted-foreground mt-1">{presetValues.span}mm</div>
          </div>

          <div>
            <Label>Rise (mm)</Label>
            <Slider
              min={100}
              max={1000}
              step={25}
              value={[presetValues.rise]}
              onValueChange={([v]) => setPresetValues({ ...presetValues, rise: v })}
            />
            <div className="text-xs text-muted-foreground mt-1">{presetValues.rise}mm</div>
          </div>
        </>
      )}

      {presetType === 'radiusHead' && (
        <>
          <div>
            <Label>Radius (mm)</Label>
            <Slider
              min={200}
              max={2000}
              step={50}
              value={[presetValues.radius]}
              onValueChange={([v]) => setPresetValues({ ...presetValues, radius: v })}
            />
            <div className="text-xs text-muted-foreground mt-1">{presetValues.radius}mm</div>
          </div>

          <div>
            <Label>Spring Line Height (mm)</Label>
            <Slider
              min={100}
              max={2000}
              step={25}
              value={[presetValues.springLineHeight]}
              onValueChange={([v]) =>
                setPresetValues({ ...presetValues, springLineHeight: v })
              }
            />
            <div className="text-xs text-muted-foreground mt-1">
              {presetValues.springLineHeight}mm
            </div>
          </div>
        </>
      )}

      {presetType === 'gothicArch' && (
        <>
          <div>
            <Label>Span (mm)</Label>
            <Slider
              min={500}
              max={3000}
              step={50}
              value={[presetValues.span]}
              onValueChange={([v]) => setPresetValues({ ...presetValues, span: v })}
            />
            <div className="text-xs text-muted-foreground mt-1">{presetValues.span}mm</div>
          </div>

          <div>
            <Label>Apex Height (mm)</Label>
            <Slider
              min={200}
              max={2000}
              step={50}
              value={[presetValues.apexHeight]}
              onValueChange={([v]) => setPresetValues({ ...presetValues, apexHeight: v })}
            />
            <div className="text-xs text-muted-foreground mt-1">
              {presetValues.apexHeight}mm
            </div>
          </div>
        </>
      )}

      <button
        onClick={handlePresetApply}
        className="w-full px-3 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90"
      >
        Apply Preset
      </button>
    </div>
  );
}

/**
 * Main curve editor component
 */
export function CurveEditor({ curve, onCurveChange }: CurveEditorProps) {
  const [editMode, setEditMode] = useState<'direct' | 'preset'>('preset');

  const handleResolutionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onCurveChange) return;
    const resolution = parseInt(e.target.value, 10);
    onCurveChange({
      ...curve,
      resolution: Math.max(8, Math.min(256, resolution)),
    });
  };

  const handleOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onCurveChange) return;
    const offset = parseFloat(e.target.value);
    onCurveChange({
      ...curve,
      offset,
    });
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{curve.name}</CardTitle>
            <CardDescription className="text-xs">
              {curve.type} • {curve.usage}
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs text-xs">
                Edit curve parameters. Use presets for quick standard arches.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mode selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setEditMode('preset')}
            className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              editMode === 'preset'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Presets
          </button>
          <button
            onClick={() => setEditMode('direct')}
            className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              editMode === 'direct'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Advanced
          </button>
        </div>

        {/* Content based on mode */}
        {editMode === 'preset' ? (
          <CurvePresetEditor curve={curve} onCurveChange={onCurveChange} />
        ) : (
          <CurveTypeEditor curve={curve} onCurveChange={onCurveChange} />
        )}

        {/* Common parameters */}
        <div className="border-t pt-4 space-y-4">
          <div>
            <Label>Resolution (segments)</Label>
            <Input
              type="number"
              min={8}
              max={256}
              step={8}
              value={curve.resolution || 64}
              onChange={handleResolutionChange}
              className="text-sm"
            />
            <div className="text-xs text-muted-foreground mt-1">
              Higher = smoother curve, more geometry
            </div>
          </div>

          <div>
            <Label>Offset (mm)</Label>
            <Input
              type="number"
              step={0.5}
              value={curve.offset || 0}
              onChange={handleOffsetChange}
              className="text-sm"
            />
            <div className="text-xs text-muted-foreground mt-1">
              Positive = outward, negative = inward (for rebates/moulding)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
