/**
 * Door Configurator Component
 * Interactive door designer with live preview and pricing
 */

'use client';

import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { DoorConfiguration } from './types';
import { DOOR_STYLES, DOOR_COLORS, GLASS_OPTIONS, STANDARD_SIZES } from './constants';
import { DOOR_PRESETS, getPresetById } from './doorPresets';
import { calculateDoorPrice, formatPrice, getPriceDescription } from './pricing';
import { generateDoorSVG } from './renderer';
import { generateTechnicalDrawing } from './technicalDrawing';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Lazy load 3D renderer for performance
const Door3DRenderer = lazy(() => 
  import('./Door3DRenderer').then(mod => ({ default: mod.Door3DRenderer }))
);
const Door3DRendererFallback = lazy(() =>
  import('./Door3DRenderer').then(mod => ({ default: mod.Door3DRendererFallback }))
);

interface DoorConfiguratorProps {
  onComplete?: (config: DoorConfiguration) => void;
  onPriceChange?: (price: number) => void;
}

export function DoorConfigurator({ onComplete, onPriceChange }: DoorConfiguratorProps) {
  const [use3DRenderer, setUse3DRenderer] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [config, setConfig] = useState<DoorConfiguration>({
    dimensions: { width: 914, height: 2032 },
    style: DOOR_STYLES[0],
    color: DOOR_COLORS[0],
    panelConfig: {
      glassInTop: false,
      glassInMiddle: false,
      glassInBottom: false,
    },
    selectedGlass: GLASS_OPTIONS[0],
    sideLight: {
      enabled: false,
      position: 'right',
      width: 300,
      hasGlass: true,
    },
    topLight: {
      enabled: false,
      height: 400,
      style: 'rectangular',
      hasGlass: true,
    },
    hardware: {
      handleStyle: 'traditional',
      letterPlate: true,
      knocker: false,
    },
  });

  // Apply preset configuration
  const applyPreset = (presetId: string) => {
    const preset = getPresetById(presetId);
    if (!preset) return;

    setSelectedPreset(presetId);
    const style = DOOR_STYLES.find(s => s.id === preset.style) || DOOR_STYLES[0];
    
    setConfig(prev => ({
      ...prev,
      dimensions: preset.dimensions,
      style,
      glazingDimensions: {
        cutOutSize: preset.cutOutSize,
        beadSize: preset.beadSize,
        glassSize: preset.glassSize,
      },
    }));
  };

  // Calculate price whenever config changes
  const priceBreakdown = useMemo(() => calculateDoorPrice(config), [config]);
  
  // Generate technical drawing for 2D mode
  const doorSVG = useMemo(() => generateTechnicalDrawing(config), [config]);

  // Notify parent of price changes
  useEffect(() => {
    if (onPriceChange) {
      onPriceChange(priceBreakdown.total);
    }
  }, [priceBreakdown.total, onPriceChange]);

  const updateConfig = (updates: Partial<DoorConfiguration>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const updateDimensions = (updates: Partial<DoorConfiguration['dimensions']>) => {
    setConfig(prev => ({ ...prev, dimensions: { ...prev.dimensions, ...updates } }));
  };

  const updatePanelConfig = (updates: Partial<DoorConfiguration['panelConfig']>) => {
    setConfig(prev => ({ ...prev, panelConfig: { ...prev.panelConfig, ...updates } }));
  };

  const updateSideLight = (updates: Partial<DoorConfiguration['sideLight']>) => {
    setConfig(prev => ({ ...prev, sideLight: { ...prev.sideLight, ...updates } }));
  };

  const updateTopLight = (updates: Partial<DoorConfiguration['topLight']>) => {
    setConfig(prev => ({ ...prev, topLight: { ...prev.topLight, ...updates } }));
  };

  const updateHardware = (updates: Partial<DoorConfiguration['hardware']>) => {
    setConfig(prev => ({ ...prev, hardware: { ...prev.hardware, ...updates } }));
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete(config);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Door Preview</CardTitle>
                <CardDescription>
                  {use3DRenderer ? 'Photorealistic 3D render' : 'Stylized 2D illustration'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="3d-toggle" className="text-sm">
                  {use3DRenderer ? '3D' : '2D'}
                </Label>
                <Switch
                  id="3d-toggle"
                  checked={use3DRenderer}
                  onCheckedChange={setUse3DRenderer}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {use3DRenderer ? (
              <Suspense fallback={
                <div className="flex items-center justify-center bg-slate-50 rounded-lg p-4 h-[600px]">
                  <div className="text-center text-slate-500">
                    <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2" />
                    <div>Loading 3D preview...</div>
                  </div>
                </div>
              }>
                <Door3DRenderer
                  config={config}
                  width={400}
                  height={600}
                  enableOrbitControls={true}
                  showInContext={false}
                />
              </Suspense>
            ) : (
              <div 
                className="flex items-center justify-center bg-slate-50 rounded-lg p-4"
                dangerouslySetInnerHTML={{ __html: doorSVG }}
              />
            )}
            
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Width:</span>
                <span className="font-medium">{config.dimensions.width}mm</span>
              </div>
              <div className="flex justify-between">
                <span>Height:</span>
                <span className="font-medium">{config.dimensions.height}mm</span>
              </div>
              {use3DRenderer && (
                <div className="text-xs text-slate-500 pt-2 border-t">
                  💡 Drag to rotate • Scroll to zoom
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Price Card */}
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle className="text-2xl text-emerald-900">
              {formatPrice(priceBreakdown.total)}
            </CardTitle>
            <CardDescription>
              Estimated price including VAT
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {getPriceDescription(priceBreakdown).map((desc, i) => (
                <div key={i} className="text-slate-600">{desc}</div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-emerald-200">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatPrice(priceBreakdown.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>VAT (20%):</span>
                <span>{formatPrice(priceBreakdown.vat)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right column: Configuration */}
      <div className="space-y-6">
        {/* Quick Presets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Start Presets</CardTitle>
            <CardDescription>Select from elevation options or customize</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preset-select" className="text-sm font-medium">
                Door Elevation
              </Label>
              <Select value={selectedPreset || ''} onValueChange={applyPreset}>
                <SelectTrigger id="preset-select">
                  <SelectValue placeholder="Choose a preset door..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Custom Size</SelectItem>
                  <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                    Large Doors
                  </div>
                  {DOOR_PRESETS.filter(p => p.category === 'large').map(preset => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name} ({preset.dimensions.width}×{preset.dimensions.height}mm)
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                    Medium Doors
                  </div>
                  {DOOR_PRESETS.filter(p => p.category === 'medium').map(preset => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name} ({preset.dimensions.width}×{preset.dimensions.height}mm)
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                    Small Doors
                  </div>
                  {DOOR_PRESETS.filter(p => p.category === 'small').map(preset => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name} ({preset.dimensions.width}×{preset.dimensions.height}mm)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPreset && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                <div className="font-medium text-emerald-900">Preset Applied</div>
                <div className="text-emerald-700">
                  {getPresetById(selectedPreset)?.description}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="style" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="style">Style</TabsTrigger>
            <TabsTrigger value="size">Size</TabsTrigger>
            <TabsTrigger value="panels">Panels</TabsTrigger>
            <TabsTrigger value="extras">Extras</TabsTrigger>
          </TabsList>

          {/* Style Tab */}
          <TabsContent value="style" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Door Style</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  {DOOR_STYLES.map(style => (
                    <button
                      key={style.id}
                      onClick={() => updateConfig({ style })}
                      className={`p-4 text-left border-2 rounded-lg transition-colors ${
                        config.style.id === style.id
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-medium">{style.name}</div>
                      <div className="text-sm text-slate-600">{style.description}</div>
                      <div className="text-xs text-slate-500 mt-1">{style.category}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Color & Finish</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {DOOR_COLORS.map(color => (
                    <button
                      key={color.id}
                      onClick={() => updateConfig({ color })}
                      className={`p-3 border-2 rounded-lg transition-colors ${
                        config.color.id === color.id
                          ? 'border-emerald-500'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div 
                        className="h-12 rounded mb-2" 
                        style={{ backgroundColor: color.hex }}
                      />
                      <div className="text-xs font-medium">{color.name}</div>
                      <div className="text-xs text-slate-500">{color.finish}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Size Tab */}
          <TabsContent value="size" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Standard Sizes</CardTitle>
                <CardDescription>Quick select common door sizes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {STANDARD_SIZES.map(size => (
                    <button
                      key={`${size.width}-${size.height}`}
                      onClick={() => updateDimensions(size)}
                      className={`p-3 text-left border-2 rounded-lg transition-colors ${
                        config.dimensions.width === size.width && config.dimensions.height === size.height
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-medium">{size.label}</div>
                      <div className="text-sm text-slate-600">{size.width}mm x {size.height}mm</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom Size</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Width: {config.dimensions.width}mm</Label>
                  <Slider
                    value={[config.dimensions.width]}
                    onValueChange={([width]) => updateDimensions({ width })}
                    min={600}
                    max={1200}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height: {config.dimensions.height}mm</Label>
                  <Slider
                    value={[config.dimensions.height]}
                    onValueChange={([height]) => updateDimensions({ height })}
                    min={1800}
                    max={2400}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Panels Tab */}
          <TabsContent value="panels" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Glass Options</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={config.selectedGlass.id}
                  onValueChange={(id) => {
                    const glass = GLASS_OPTIONS.find(g => g.id === id);
                    if (glass) updateConfig({ selectedGlass: glass });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GLASS_OPTIONS.map(glass => (
                      <SelectItem key={glass.id} value={glass.id}>
                        {glass.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Panel Glazing</CardTitle>
                <CardDescription>Choose which panels have glass</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Glass in top panel</Label>
                  <Switch
                    checked={config.panelConfig.glassInTop}
                    onCheckedChange={(checked) => updatePanelConfig({ glassInTop: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Glass in middle panel</Label>
                  <Switch
                    checked={config.panelConfig.glassInMiddle}
                    onCheckedChange={(checked) => updatePanelConfig({ glassInMiddle: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Glass in bottom panel</Label>
                  <Switch
                    checked={config.panelConfig.glassInBottom}
                    onCheckedChange={(checked) => updatePanelConfig({ glassInBottom: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Extras Tab */}
          <TabsContent value="extras" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Side Lights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable side lights</Label>
                  <Switch
                    checked={config.sideLight.enabled}
                    onCheckedChange={(checked) => updateSideLight({ enabled: checked })}
                  />
                </div>
                
                {config.sideLight.enabled && (
                  <>
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Select
                        value={config.sideLight.position}
                        onValueChange={(position: any) => updateSideLight({ position })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Width: {config.sideLight.width}mm</Label>
                      <Slider
                        value={[config.sideLight.width]}
                        onValueChange={([width]) => updateSideLight({ width })}
                        min={200}
                        max={500}
                        step={50}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Glazed</Label>
                      <Switch
                        checked={config.sideLight.hasGlass}
                        onCheckedChange={(hasGlass) => updateSideLight({ hasGlass })}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Light (Overlight)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable top light</Label>
                  <Switch
                    checked={config.topLight.enabled}
                    onCheckedChange={(checked) => updateTopLight({ enabled: checked })}
                  />
                </div>

                {config.topLight.enabled && (
                  <>
                    <div className="space-y-2">
                      <Label>Style</Label>
                      <Select
                        value={config.topLight.style}
                        onValueChange={(style: any) => updateTopLight({ style })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rectangular">Rectangular</SelectItem>
                          <SelectItem value="arched">Arched</SelectItem>
                          <SelectItem value="curved">Curved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Height: {config.topLight.height}mm</Label>
                      <Slider
                        value={[config.topLight.height]}
                        onValueChange={([height]) => updateTopLight({ height })}
                        min={200}
                        max={600}
                        step={50}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Glazed</Label>
                      <Switch
                        checked={config.topLight.hasGlass}
                        onCheckedChange={(hasGlass) => updateTopLight({ hasGlass })}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hardware & Furniture</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Handle Style</Label>
                  <Select
                    value={config.hardware.handleStyle}
                    onValueChange={(handleStyle: any) => updateHardware({ handleStyle })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="traditional">Traditional</SelectItem>
                      <SelectItem value="contemporary">Contemporary (+£150)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Letter Plate (+£85)</Label>
                  <Switch
                    checked={config.hardware.letterPlate}
                    onCheckedChange={(letterPlate) => updateHardware({ letterPlate })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Door Knocker (+£95)</Label>
                  <Switch
                    checked={config.hardware.knocker}
                    onCheckedChange={(knocker) => updateHardware({ knocker })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {onComplete && (
          <Button onClick={handleComplete} className="w-full" size="lg">
            Add to Quote
          </Button>
        )}
      </div>
    </div>
  );
}
