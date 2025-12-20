/**
 * Hero UI Control Panel
 * Minimal floating control for hero preview mode
 * Shows only a button to open drawer with camera/view options
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, RotateCcw, Eye } from 'lucide-react';
import { CameraMode } from '@/types/scene-config';

interface HeroUIControlProps {
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  onResetCamera: () => void;
  onUIToggle?: (key: string, value: boolean) => void;
  showGuides?: boolean;
  showAxis?: boolean;
}

export function HeroUIControl({
  cameraMode,
  onCameraModeChange,
  onResetCamera,
  onUIToggle,
  showGuides = false,
  showAxis = false,
}: HeroUIControlProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      <div className="absolute top-4 right-4 z-50 pointer-events-auto">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          size="sm"
          variant="outline"
          className="gap-2 bg-white/90 backdrop-blur hover:bg-white shadow-lg"
        >
          <Eye className="h-4 w-4" />
          View Options
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {/* Drawer panel */}
      {isOpen && (
        <div className="absolute top-16 right-4 z-50 pointer-events-auto bg-white/95 backdrop-blur rounded-lg shadow-xl border border-gray-200 p-4 max-w-xs">
          {/* Camera mode toggle */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Camera</div>
            <div className="flex gap-2">
              <Button
                onClick={() => onCameraModeChange('Perspective')}
                size="sm"
                variant={cameraMode === 'Perspective' ? 'default' : 'outline'}
                className="flex-1 text-xs"
              >
                Perspective
              </Button>
              <Button
                onClick={() => onCameraModeChange('Ortho')}
                size="sm"
                variant={cameraMode === 'Ortho' ? 'default' : 'outline'}
                className="flex-1 text-xs"
              >
                Ortho
              </Button>
            </div>

            {/* Reset button */}
            <Button
              onClick={onResetCamera}
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
            >
              <RotateCcw className="h-3 w-3" />
              Reset View
            </Button>

            {/* Optional guides toggle */}
            {onUIToggle && (
              <div className="space-y-2 border-t border-gray-200 pt-3">
                <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Guides</div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGuides}
                    onChange={(e) => onUIToggle('guides', e.target.checked)}
                    className="rounded"
                  />
                  <span>Show Grid</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAxis}
                    onChange={(e) => onUIToggle('axis', e.target.checked)}
                    className="rounded"
                  />
                  <span>Show Axis</span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
