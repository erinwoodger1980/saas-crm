/**
 * Scene UI Component
 * UI controls for camera mode, visibility toggles, component tree
 * Matches FileMaker UI layout and behaviour
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Camera,
  Eye,
  EyeOff,
  Grid3x3,
  Axis3D,
  Ruler,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { ComponentNode, UIToggles, CameraMode } from '@/types/scene-config';

interface SceneUIProps {
  components: ComponentNode[];
  ui: UIToggles;
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  onUIToggle: (key: keyof UIToggles, value: boolean) => void;
  onVisibilityToggle: (componentId: string, visible: boolean) => void;
  onResetCamera: () => void;
  qualityEnabled?: boolean;
  onQualityToggle?: (enabled: boolean) => void;
}

/**
 * Component tree item with expand/collapse
 */
function ComponentTreeItem({
  node,
  depth = 0,
  onVisibilityToggle,
}: {
  node: ComponentNode;
  depth?: number;
  onVisibilityToggle: (componentId: string, visible: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 hover:bg-accent/50 rounded px-2"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse button */}
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 hover:bg-accent rounded"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-4" />}

        {/* Visibility toggle */}
        <button
          onClick={() => onVisibilityToggle(node.id, !node.visible)}
          className="p-0.5 hover:bg-accent rounded"
        >
          {node.visible ? (
            <Eye className="h-4 w-4 text-blue-600" />
          ) : (
            <EyeOff className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {/* Component name */}
        <span className="text-sm flex-1">{node.name}</span>

        {/* Component type badge */}
        <span className="text-xs text-muted-foreground">{node.type}</span>
      </div>

      {/* Render children */}
      {hasChildren && expanded && (
        <div>
          {(Array.isArray(node.children) ? node.children : []).map((child) => (
            <ComponentTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onVisibilityToggle={onVisibilityToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SceneUI({
  components,
  ui,
  cameraMode,
  onCameraModeChange,
  onUIToggle,
  onVisibilityToggle,
  onResetCamera,
  qualityEnabled = true,
  onQualityToggle,
}: SceneUIProps) {
  return (
    <div className="absolute top-4 right-4 w-80 space-y-3 pointer-events-auto">
      {/* Camera Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Camera
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Camera mode toggle */}
          <div className="flex gap-2">
            <Button
              variant={cameraMode === 'Perspective' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCameraModeChange('Perspective')}
              className="flex-1"
            >
              Perspective
            </Button>
            <Button
              variant={cameraMode === 'Ortho' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCameraModeChange('Ortho')}
              className="flex-1"
            >
              Orthographic
            </Button>
          </div>

          {/* Reset camera button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onResetCamera}
            className="w-full"
          >
            Reset View
          </Button>

          {/* Quality toggle */}
          {onQualityToggle && (
            <div className="flex items-center justify-between pt-1">
              <Label htmlFor="quality" className="flex items-center gap-2 text-sm">
                <Camera className="h-4 w-4" />
                High Quality
              </Label>
              <Switch
                id="quality"
                checked={qualityEnabled}
                onCheckedChange={(checked) => onQualityToggle(checked)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Options */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">View Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {/* Guides toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="guides" className="flex items-center gap-2 text-sm">
              <Grid3x3 className="h-4 w-4" />
              Guides
            </Label>
            <Switch
              id="guides"
              checked={ui.guides}
              onCheckedChange={(checked) => onUIToggle('guides', checked)}
            />
          </div>

          {/* Axis toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="axis" className="flex items-center gap-2 text-sm">
              <Axis3D className="h-4 w-4" />
              Axis
            </Label>
            <Switch
              id="axis"
              checked={ui.axis}
              onCheckedChange={(checked) => onUIToggle('axis', checked)}
            />
          </div>

          {/* Dimensions toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="dimensions" className="flex items-center gap-2 text-sm">
              <Ruler className="h-4 w-4" />
              Dimensions
            </Label>
            <Switch
              id="dimensions"
              checked={ui.dimensions}
              onCheckedChange={(checked) => onUIToggle('dimensions', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Component Tree */}
      {ui.componentList && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Components</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <div className="h-[400px] overflow-auto">
              <div className="p-2">
                {(Array.isArray(components) ? components : []).map((component) => (
                  <ComponentTreeItem
                    key={component.id}
                    node={component}
                    onVisibilityToggle={onVisibilityToggle}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
