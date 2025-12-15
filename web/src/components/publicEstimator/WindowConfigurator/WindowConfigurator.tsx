/**
 * Window Configurator Component
 * Interactive UI for configuring bespoke timber windows
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { WindowConfiguration } from './types';
import {
  SASH_WINDOW_STYLES,
  CASEMENT_WINDOW_STYLES,
  ALU_CLAD_WINDOW_STYLES,
  ALL_WINDOW_STYLES,
  WINDOW_COLORS,
  GLAZING_OPTIONS,
  STANDARD_WINDOW_SIZES,
  PRICING_MATRIX,
} from './constants';
import { calculateWindowPrice, formatPrice, getPriceDescription } from './pricing';
import { generateWindowSVG } from './renderer';

interface WindowConfiguratorProps {
  onComplete?: (config: WindowConfiguration) => void;
  onPriceChange?: (price: number) => void;
}

export function WindowConfigurator({ onComplete, onPriceChange }: WindowConfiguratorProps) {
  const [config, setConfig] = useState<WindowConfiguration>({
    dimensions: {
      width: 1200,
      height: 1500,
      columns: 2,
      rows: 1,
    },
    windowType: 'sash',
    style: SASH_WINDOW_STYLES[0],
    color: WINDOW_COLORS[0],
    glazing: GLAZING_OPTIONS[1], // Double Low-E by default
    hardware: {
      locks: 'standard',
      handles: 'traditional',
      restrictors: false,
      trickleVents: false,
    },
    features: {
      doubleGlazing: true,
      tripleGlazing: false,
      lowE: true,
      argonFilled: false,
      Georgian: false,
      leaded: false,
      tiltIn: false,
      restrictorStays: false,
    },
  });

  // Calculate price
  const priceBreakdown = useMemo(() => {
    return calculateWindowPrice(config, PRICING_MATRIX);
  }, [config]);

  // Generate SVG
  const windowSvg = useMemo(() => {
    return generateWindowSVG({ config, width: 500, height: 600 });
  }, [config]);

  // Notify parent of price changes
  useEffect(() => {
    if (onPriceChange) {
      onPriceChange(priceBreakdown.total);
    }
  }, [priceBreakdown.total, onPriceChange]);

  // Get available styles for current window type
  const availableStyles = useMemo(() => {
    if (config.windowType === 'sash') return SASH_WINDOW_STYLES;
    if (config.windowType === 'casement') return CASEMENT_WINDOW_STYLES;
    return ALU_CLAD_WINDOW_STYLES;
  }, [config.windowType]);

  // Get available colors for current window type
  const availableColors = useMemo(() => {
    return WINDOW_COLORS.filter(color => 
      color.availableForTypes.includes(config.windowType)
    );
  }, [config.windowType]);

  // Handle window type change
  const handleWindowTypeChange = (type: 'sash' | 'casement' | 'alu-clad') => {
    const newStyles = type === 'sash' ? SASH_WINDOW_STYLES : 
                     type === 'casement' ? CASEMENT_WINDOW_STYLES : 
                     ALU_CLAD_WINDOW_STYLES;
    
    setConfig(prev => ({
      ...prev,
      windowType: type,
      style: newStyles[0],
      color: WINDOW_COLORS.find(c => c.availableForTypes.includes(type)) || WINDOW_COLORS[0],
    }));
  };

  const totalUnits = config.dimensions.columns * config.dimensions.rows;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Preview and Price */}
      <div className="space-y-4">
        {/* Live Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
            <CardDescription>
              {totalUnits} window unit{totalUnits > 1 ? 's' : ''} ({config.dimensions.columns} × {config.dimensions.rows})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className="w-full bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: windowSvg }}
            />
          </CardContent>
        </Card>

        {/* Price Card */}
        <Card>
          <CardHeader>
            <CardTitle>Price</CardTitle>
            <CardDescription>Including VAT and all selected options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold text-slate-900">
              {formatPrice(priceBreakdown.total)}
            </div>
            <div className="text-sm text-slate-600 space-y-1">
              {getPriceDescription(priceBreakdown, totalUnits).map((desc, idx) => (
                <div key={idx}>{desc}</div>
              ))}
            </div>
            {totalUnits > 1 && (
              <div className="pt-2 text-sm font-semibold text-emerald-700">
                ✓ Multi-unit discount applied!
              </div>
            )}
            {onComplete && (
              <Button onClick={() => onComplete(config)} className="w-full mt-4">
                Add to Quote
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Configuration Tabs */}
      <div>
        <Tabs defaultValue="type" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="type">Type</TabsTrigger>
            <TabsTrigger value="style">Style</TabsTrigger>
            <TabsTrigger value="size">Size</TabsTrigger>
            <TabsTrigger value="glazing">Glazing</TabsTrigger>
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
          </TabsList>

          {/* Type Tab */}
          <TabsContent value="type" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Window Type</CardTitle>
                <CardDescription>Choose between sash, casement, or alu-clad windows</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant={config.windowType === 'sash' ? 'default' : 'outline'}
                    onClick={() => handleWindowTypeChange('sash')}
                    className="h-auto py-4 flex flex-col items-start"
                  >
                    <span className="font-semibold">Sash Windows</span>
                    <span className="text-xs font-normal mt-1">
                      Traditional sliding sash with authentic mechanism
                    </span>
                  </Button>
                  <Button
                    variant={config.windowType === 'casement' ? 'default' : 'outline'}
                    onClick={() => handleWindowTypeChange('casement')}
                    className="h-auto py-4 flex flex-col items-start"
                  >
                    <span className="font-semibold">Casement Windows</span>
                    <span className="text-xs font-normal mt-1">
                      Side or top hung opening windows
                    </span>
                  </Button>
                  <Button
                    variant={config.windowType === 'alu-clad' ? 'default' : 'outline'}
                    onClick={() => handleWindowTypeChange('alu-clad')}
                    className="h-auto py-4 flex flex-col items-start"
                  >
                    <span className="font-semibold">Alu-Clad Windows</span>
                    <span className="text-xs font-normal mt-1">
                      Premium timber with aluminum exterior cladding
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Style Tab */}
          <TabsContent value="style" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Window Style</CardTitle>
                <CardDescription>Select your preferred style and color</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Style Selection */}
                <div className="space-y-3">
                  <Label>Style</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {availableStyles.map((style) => (
                      <Button
                        key={style.id}
                        variant={config.style.id === style.id ? 'default' : 'outline'}
                        onClick={() => setConfig(prev => ({ ...prev, style }))}
                        className="h-auto py-3 flex flex-col items-start"
                      >
                        <span className="font-semibold">{style.name}</span>
                        <span className="text-xs font-normal mt-1">{style.description}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Color Selection */}
                <div className="space-y-3">
                  <Label>Color & Finish</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableColors.map((color) => (
                      <Button
                        key={color.id}
                        variant={config.color.id === color.id ? 'default' : 'outline'}
                        onClick={() => setConfig(prev => ({ ...prev, color }))}
                        className="h-auto py-3 justify-start"
                      >
                        <div
                          className="w-6 h-6 rounded border border-slate-300 mr-2"
                          style={{ backgroundColor: color.hexColor }}
                        />
                        <span className="text-sm">{color.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Size Tab */}
          <TabsContent value="size" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Window Size</CardTitle>
                <CardDescription>Configure dimensions and layout</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Standard Sizes */}
                <div className="space-y-3">
                  <Label>Standard Sizes (per unit)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {STANDARD_WINDOW_SIZES.map((size) => (
                      <Button
                        key={size.label}
                        variant="outline"
                        onClick={() => setConfig(prev => ({
                          ...prev,
                          dimensions: { ...prev.dimensions, width: size.width, height: size.height }
                        }))}
                        className="text-sm"
                      >
                        {size.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Custom Dimensions */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Width per unit: {config.dimensions.width}mm</Label>
                    <Slider
                      value={[config.dimensions.width]}
                      onValueChange={(value) => setConfig(prev => ({
                        ...prev,
                        dimensions: { ...prev.dimensions, width: value[0] }
                      }))}
                      min={600}
                      max={1800}
                      step={50}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Height per unit: {config.dimensions.height}mm</Label>
                    <Slider
                      value={[config.dimensions.height]}
                      onValueChange={(value) => setConfig(prev => ({
                        ...prev,
                        dimensions: { ...prev.dimensions, height: value[0] }
                      }))}
                      min={800}
                      max={2400}
                      step={50}
                    />
                  </div>
                </div>

                {/* Multi-Unit Layout */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Multi-Unit Configuration</Label>
                  <div className="space-y-2">
                    <Label>Columns (side by side): {config.dimensions.columns}</Label>
                    <Slider
                      value={[config.dimensions.columns]}
                      onValueChange={(value) => setConfig(prev => ({
                        ...prev,
                        dimensions: { ...prev.dimensions, columns: value[0] }
                      }))}
                      min={1}
                      max={4}
                      step={1}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Rows (stacked): {config.dimensions.rows}</Label>
                    <Slider
                      value={[config.dimensions.rows]}
                      onValueChange={(value) => setConfig(prev => ({
                        ...prev,
                        dimensions: { ...prev.dimensions, rows: value[0] }
                      }))}
                      min={1}
                      max={3}
                      step={1}
                    />
                  </div>
                </div>

                <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded">
                  Total coverage: {(config.dimensions.width * config.dimensions.columns)}mm × {(config.dimensions.height * config.dimensions.rows)}mm
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Glazing Tab */}
          <TabsContent value="glazing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Glazing Options</CardTitle>
                <CardDescription>Select glazing type and features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Glazing Type */}
                <div className="space-y-3">
                  <Label>Glazing Type</Label>
                  <Select
                    value={config.glazing.id}
                    onValueChange={(value) => {
                      const glazing = GLAZING_OPTIONS.find(g => g.id === value);
                      if (glazing) setConfig(prev => ({ ...prev, glazing }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GLAZING_OPTIONS.map((glazing) => (
                        <SelectItem key={glazing.id} value={glazing.id}>
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">{glazing.name}</span>
                            <span className="text-xs text-slate-500">U-value: {glazing.uValue} W/m²K</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded">
                    <p className="font-semibold mb-1">{config.glazing.description}</p>
                    <ul className="text-xs space-y-1">
                      {config.glazing.features.map((feature, idx) => (
                        <li key={idx}>✓ {feature}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Additional Features */}
                <div className="space-y-3">
                  <Label>Additional Features</Label>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Georgian Bars</Label>
                      <p className="text-sm text-slate-500">Traditional glazing bars</p>
                    </div>
                    <Switch
                      checked={config.features.Georgian}
                      onCheckedChange={(checked) => setConfig(prev => ({
                        ...prev,
                        features: { ...prev.features, Georgian: checked }
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Leaded Lights</Label>
                      <p className="text-sm text-slate-500">Decorative lead came work</p>
                    </div>
                    <Switch
                      checked={config.features.leaded}
                      onCheckedChange={(checked) => setConfig(prev => ({
                        ...prev,
                        features: { ...prev.features, leaded: checked }
                      }))}
                    />
                  </div>

                  {config.windowType === 'sash' && (
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Tilt-In Mechanism</Label>
                        <p className="text-sm text-slate-500">Easy cleaning access</p>
                      </div>
                      <Switch
                        checked={config.features.tiltIn}
                        onCheckedChange={(checked) => setConfig(prev => ({
                          ...prev,
                          features: { ...prev.features, tiltIn: checked }
                        }))}
                      />
                    </div>
                  )}

                  {config.windowType === 'casement' && (
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Restrictor Stays</Label>
                        <p className="text-sm text-slate-500">Safety limiters for opening</p>
                      </div>
                      <Switch
                        checked={config.features.restrictorStays}
                        onCheckedChange={(checked) => setConfig(prev => ({
                          ...prev,
                          features: { ...prev.features, restrictorStays: checked }
                        }))}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hardware Tab */}
          <TabsContent value="hardware" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Hardware & Fittings</CardTitle>
                <CardDescription>Locks, handles, and accessories</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Lock Type */}
                <div className="space-y-3">
                  <Label>Lock Type</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      variant={config.hardware.locks === 'standard' ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        hardware: { ...prev.hardware, locks: 'standard' }
                      }))}
                      className="justify-start h-auto py-3"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">Standard Locks</span>
                        <span className="text-xs font-normal">Included</span>
                      </div>
                    </Button>
                    <Button
                      variant={config.hardware.locks === 'security' ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        hardware: { ...prev.hardware, locks: 'security' }
                      }))}
                      className="justify-start h-auto py-3"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">Security Locks</span>
                        <span className="text-xs font-normal">+£{PRICING_MATRIX.hardwareAddons.securityLocks} per unit</span>
                      </div>
                    </Button>
                    <Button
                      variant={config.hardware.locks === 'premium' ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        hardware: { ...prev.hardware, locks: 'premium' }
                      }))}
                      className="justify-start h-auto py-3"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">Premium Locks</span>
                        <span className="text-xs font-normal">+£{PRICING_MATRIX.hardwareAddons.premiumLocks} per unit</span>
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Handle Style */}
                <div className="space-y-3">
                  <Label>Handle Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={config.hardware.handles === 'traditional' ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        hardware: { ...prev.hardware, handles: 'traditional' }
                      }))}
                    >
                      Traditional
                    </Button>
                    <Button
                      variant={config.hardware.handles === 'contemporary' ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        hardware: { ...prev.hardware, handles: 'contemporary' }
                      }))}
                    >
                      Contemporary (+£{PRICING_MATRIX.hardwareAddons.contemporaryHandles}/unit)
                    </Button>
                  </div>
                </div>

                {/* Additional Hardware */}
                <div className="space-y-3">
                  <Label>Additional Hardware</Label>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Safety Restrictors</Label>
                      <p className="text-sm text-slate-500">For upper floor windows (+£{PRICING_MATRIX.hardwareAddons.restrictors}/unit)</p>
                    </div>
                    <Switch
                      checked={config.hardware.restrictors}
                      onCheckedChange={(checked) => setConfig(prev => ({
                        ...prev,
                        hardware: { ...prev.hardware, restrictors: checked }
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Trickle Vents</Label>
                      <p className="text-sm text-slate-500">Background ventilation (+£{PRICING_MATRIX.hardwareAddons.trickleVents}/unit)</p>
                    </div>
                    <Switch
                      checked={config.hardware.trickleVents}
                      onCheckedChange={(checked) => setConfig(prev => ({
                        ...prev,
                        hardware: { ...prev.hardware, trickleVents: checked }
                      }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
