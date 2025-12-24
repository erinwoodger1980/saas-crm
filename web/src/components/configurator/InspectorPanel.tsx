/**
 * Inspector Panel
 * Displays and edits attributes of selected component
 * Supports standard attributes and curve definitions
 */

'use client';

import { useState, useEffect } from 'react';
import { EditableAttribute, CurveDefinition } from '@/types/parametric-builder';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CurveEditor } from './CurveEditor';

interface InspectorPanelProps {
  selectedComponentId: string | null;
  attributes: EditableAttribute[] | null;
  onAttributeChange: (changes: Record<string, any>) => void;
  curve?: CurveDefinition | null;
  onCurveChange?: (curve: CurveDefinition) => void;
  componentName?: string;
  componentType?: string;
  componentMaterialId?: string;
  componentProfileId?: string;
  availableMaterials?: Array<{ id: string; name: string }>;
  onComponentMetadataChange?: (changes: { name?: string; type?: string; materialId?: string }) => void;
  availableProfiles?: Array<{ id: string; name: string }>;
  onComponentProfileChange?: (profileId: string | null) => void;
}

function InspectorPanel({
  selectedComponentId,
  attributes,
  onAttributeChange,
  curve,
  onCurveChange,
  componentName,
  componentType,
  componentMaterialId,
  componentProfileId,
  availableMaterials = [],
  onComponentMetadataChange,
  availableProfiles = [],
  onComponentProfileChange,
}: InspectorPanelProps) {
  const [localValues, setLocalValues] = useState<Record<string, any>>({});
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});

  // Reset local values when selection changes
  useEffect(() => {
    if (attributes) {
      const values: Record<string, any> = {};
      attributes.forEach(attr => {
        values[attr.key] = attr.value;
      });
      setLocalValues(values);
      setPendingChanges({});
    }
  }, [attributes, selectedComponentId]);

  if (!selectedComponentId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inspector</CardTitle>
          <CardDescription>
            Select a component to edit its properties
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Show curve editor if component has curve
  if (curve && onCurveChange) {
    return (
      <Card className="overflow-auto max-h-[calc(80vh-8rem)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Curve Editor</CardTitle>
          <CardDescription className="text-xs">
            Editing: {selectedComponentId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CurveEditor curve={curve} onCurveChange={onCurveChange} />
        </CardContent>
      </Card>
    );
  }

  if (!attributes || attributes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inspector</CardTitle>
          <CardDescription className="text-xs">
            {selectedComponentId}: No editable properties
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleChange = (key: string, value: any) => {
    setLocalValues(prev => ({ ...prev, [key]: value }));
    setPendingChanges(prev => ({ ...prev, [key]: value }));
  };

  const handleBlur = () => {
    if (Object.keys(pendingChanges).length > 0) {
      onAttributeChange(pendingChanges);
      setPendingChanges({});
    }
  };

  const renderAttribute = (attr: EditableAttribute) => {
    const value = localValues[attr.key] ?? attr.value;

    switch (attr.type) {
      case 'number':
        return (
          <div key={attr.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={attr.key} className="text-sm">
                {attr.label}
                {attr.helpText && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="inline h-3 w-3 ml-1 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{attr.helpText}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </Label>
              <span className="text-xs text-muted-foreground">
                {value}{attr.unit && ` ${attr.unit}`}
              </span>
            </div>
            
            {attr.min !== undefined && attr.max !== undefined ? (
              <div className="space-y-2">
                <Slider
                  id={attr.key}
                  min={attr.min}
                  max={attr.max}
                  step={attr.step || 1}
                  value={[value]}
                  onValueChange={([v]) => handleChange(attr.key, v)}
                  onValueCommit={() => handleBlur()}
                />
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => handleChange(attr.key, Number(e.target.value))}
                  onBlur={handleBlur}
                  min={attr.min}
                  max={attr.max}
                  step={attr.step || 1}
                  className="h-8 text-sm"
                />
              </div>
            ) : (
              <Input
                id={attr.key}
                type="number"
                value={value}
                onChange={(e) => handleChange(attr.key, Number(e.target.value))}
                onBlur={handleBlur}
                min={attr.min}
                max={attr.max}
                step={attr.step || 1}
                className="h-8"
              />
            )}
          </div>
        );

      case 'text':
        return (
          <div key={attr.key} className="space-y-2">
            <Label htmlFor={attr.key} className="text-sm">
              {attr.label}
              {attr.helpText && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline h-3 w-3 ml-1 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{attr.helpText}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </Label>
            <Input
              id={attr.key}
              type="text"
              value={value}
              onChange={(e) => handleChange(attr.key, e.target.value)}
              onBlur={handleBlur}
              className="h-8"
            />
          </div>
        );

      case 'select':
        return (
          <div key={attr.key} className="space-y-2">
            <Label htmlFor={attr.key} className="text-sm">
              {attr.label}
              {attr.helpText && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline h-3 w-3 ml-1 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{attr.helpText}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </Label>
            <Select
              value={value}
              onValueChange={(v) => {
                handleChange(attr.key, v);
                // Select triggers change immediately
                setTimeout(() => {
                  onAttributeChange({ [attr.key]: v });
                  setPendingChanges({});
                }, 0);
              }}
            >
              <SelectTrigger id={attr.key} className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {attr.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'boolean':
        return (
          <div key={attr.key} className="flex items-center justify-between py-2">
            <Label htmlFor={attr.key} className="text-sm">
              {attr.label}
              {attr.helpText && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline h-3 w-3 ml-1 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{attr.helpText}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </Label>
            <Switch
              id={attr.key}
              checked={value}
              onCheckedChange={(checked) => {
                handleChange(attr.key, checked);
                onAttributeChange({ [attr.key]: checked });
                setPendingChanges({});
              }}
            />
          </div>
        );

      case 'color':
        return (
          <div key={attr.key} className="space-y-2">
            <Label htmlFor={attr.key} className="text-sm">
              {attr.label}
            </Label>
            <div className="flex gap-2">
              <input
                id={attr.key}
                type="color"
                value={value}
                onChange={(e) => handleChange(attr.key, e.target.value)}
                onBlur={handleBlur}
                className="h-8 w-16 rounded border cursor-pointer"
              />
              <Input
                type="text"
                value={value}
                onChange={(e) => handleChange(attr.key, e.target.value)}
                onBlur={handleBlur}
                className="h-8 flex-1 font-mono text-sm"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="overflow-auto max-h-[calc(80vh-8rem)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Properties</CardTitle>
        <CardDescription className="text-xs">
          Editing: {selectedComponentId}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Component metadata section */}
        {onComponentMetadataChange && (
          <div className="space-y-3 border-b pb-4">
            <h4 className="text-xs font-semibold text-muted-foreground">COMPONENT INFO</h4>
            
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="comp-name" className="text-sm">Component Name</Label>
              <Input
                id="comp-name"
                value={componentName || ''}
                onChange={(e) => onComponentMetadataChange({ name: e.target.value })}
                placeholder="e.g., Left Rail"
                className="h-8 text-sm"
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="comp-type" className="text-sm">Type</Label>
              <Input
                id="comp-type"
                value={componentType || ''}
                onChange={(e) => onComponentMetadataChange({ type: e.target.value })}
                placeholder="e.g., rail"
                className="h-8 text-sm"
              />
            </div>

            {/* Material */}
            {availableMaterials.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="comp-material" className="text-sm">Material</Label>
                <Select
                  value={componentMaterialId || ''}
                  onValueChange={(val) => onComponentMetadataChange({ materialId: val })}
                >
                  <SelectTrigger id="comp-material" className="h-8">
                    <SelectValue placeholder="Select material..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMaterials.map(mat => (
                      <SelectItem key={mat.id} value={mat.id}>
                        {mat.name || mat.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Profile */}
            {availableProfiles.length > 0 && onComponentProfileChange && (
              <div className="space-y-2">
                <Label htmlFor="comp-profile" className="text-sm">Profile</Label>
                <Select
                  value={componentProfileId || ''}
                  onValueChange={(val) => onComponentProfileChange(val || null)}
                >
                  <SelectTrigger id="comp-profile" className="h-8">
                    <SelectValue placeholder="Select profile..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProfiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name || profile.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Attributes section */}
        {attributes && attributes.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground">PROPERTIES</h4>
            {attributes.map(renderAttribute)}
          </div>
        )}

        {!attributes || (attributes.length === 0 && !onComponentMetadataChange) && (
          <p className="text-xs text-muted-foreground">No properties available</p>
        )}
      </CardContent>
    </Card>
  );
}

export default InspectorPanel;
