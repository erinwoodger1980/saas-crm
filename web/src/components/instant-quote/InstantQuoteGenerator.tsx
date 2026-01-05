'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  Package, 
  Calculator,
  FileText,
  Clock,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface InstantQuoteResult {
  analysis: {
    productType: string;
    confidence: number;
    description: string;
  };
  components: Array<{
    code: string;
    name: string;
    position: { x: number; y: number; z: number };
    dimensions: { width: number; height: number; depth: number };
  }>;
  bom: Array<{
    code: string;
    name: string;
    dimensions: { width: number; height: number; depth: number };
    volume: number;
    estimatedCost: number;
  }>;
  cuttingList: Array<{
    componentCode: string;
    componentName: string;
    length: number;
    width: number;
    thickness: number;
    grain: string;
  }>;
  processes: Array<{
    name: string;
    duration: number;
    sequence: number;
  }>;
  pricing: {
    materialCost: number;
    labourCost: number;
    totalTime: number;
    markup: number;
    totalPrice: number;
  };
  sceneConfig: any;
}

type InstantQuoteGeneratorProps = {
  onAddToQuote?: (data: InstantQuoteResult, dims: { width: number; height: number; depth: number }) => Promise<void> | void;
  productTypeHint?: { category: string; type?: string; option?: string } | null;
};

export function InstantQuoteGenerator(props: InstantQuoteGeneratorProps) {
  const { onAddToQuote, productTypeHint } = props;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [dimensions, setDimensions] = useState({
    width: 900,
    height: 2100,
    depth: 54
  });
  const [result, setResult] = useState<InstantQuoteResult | null>(null);
  const [currentStep, setCurrentStep] = useState<'upload' | 'analyzing' | 'results'>('upload');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file',
        variant: 'destructive'
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Convert to base64 for API
    const base64Reader = new FileReader();
    base64Reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      setImageBase64(base64);
    };
    base64Reader.readAsDataURL(file);
  };

  const handleGenerateQuote = async () => {
    if (!imageBase64 && !description) {
      toast({
        title: 'Missing input',
        description: 'Please upload a photo or add a description',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    setCurrentStep('analyzing');

    try {
      // Use existing AI component estimator route (no new routes)
      const payload = {
        tenantId: 'current',
        description: description || 'Instant quote generation',
        productType: productTypeHint || { category: 'doors', type: 'standard', option: 'GEN' },
        existingDimensions: { widthMm: dimensions.width, heightMm: dimensions.height, thicknessMm: dimensions.depth },
        imageBase64,
      };
      const response = await fetch('/api/ai/estimate-components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || 'Failed to analyze product');
      }

      const est = await response.json();
      // Transform estimation result into our InstantQuoteResult structure
      const components = Array.isArray(est.components)
        ? est.components.map((c: any, idx: number) => ({
            code: c.label?.toUpperCase().replace(/\s+/g, '_') || `COMP_${idx + 1}`,
            name: c.label || `Component ${idx + 1}`,
            position: { x: Number(c.position?.x) || 0, y: Number(c.position?.y) || 0, z: Number(c.position?.z) || 0 },
            dimensions: {
              width: Number(c.geometry?.width) || 0,
              height: Number(c.geometry?.height) || 0,
              depth: Number(c.geometry?.depth) || dimensions.depth,
            },
          }))
        : [];

      const bom = components.map((comp: any) => {
        const volume = (comp.dimensions.width * comp.dimensions.height * comp.dimensions.depth) / 1000000;
        return {
          code: comp.code,
          name: comp.name,
          dimensions: comp.dimensions,
          volume,
          estimatedCost: volume * 800,
        };
      });

      const cuttingList = components.map((comp: any) => ({
        componentCode: comp.code,
        componentName: comp.name,
        length: comp.dimensions.width,
        width: comp.dimensions.height,
        thickness: comp.dimensions.depth,
        grain: 'Along length',
      }));

      const processes = [
        { name: 'Cutting', duration: 30, sequence: 1 },
        { name: 'Machining (profiles)', duration: 45, sequence: 2 },
        { name: 'Assembly', duration: 60, sequence: 3 },
        { name: 'Finishing', duration: 90, sequence: 4 },
      ];
      const totalTime = processes.reduce((sum: number, p: any) => sum + p.duration, 0);
      const materialCost = bom.reduce((sum: number, b: any) => sum + b.estimatedCost, 0);
      const labourCost = (totalTime / 60) * 45;
      const totalPrice = (materialCost + labourCost) * 1.4;

      const data: InstantQuoteResult = {
        analysis: {
          productType: payload.productType.category,
          confidence: Number(est.confidence) || 0.9,
          description: description || 'AI-generated product',
        },
        components,
        bom,
        cuttingList,
        processes,
        pricing: {
          materialCost,
          labourCost,
          totalTime,
          markup: 0.4,
          totalPrice: Math.round(totalPrice * 100) / 100,
        },
        sceneConfig: { components },
      };

      setResult(data);
      setCurrentStep('results');

      toast({
        title: 'Quote generated!',
        description: `${data.components.length} components, £${data.pricing.totalPrice.toFixed(2)}`,
      });

    } catch (error: any) {
      console.error('Generate quote error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      setCurrentStep('upload');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuoteLine = async () => {
    if (!result) return;

    try {
      if (onAddToQuote) {
        await onAddToQuote(result, dimensions);
      }
      toast({
        title: 'Quote line created',
        description: 'Product added to quote successfully',
      });
    } catch (err: any) {
      toast({ title: 'Add to quote failed', description: err?.message || 'Unable to add line', variant: 'destructive' });
      return;
    }

    // Reset for next product
    setResult(null);
    setImagePreview(null);
    setImageBase64(null);
    setDescription('');
    setCurrentStep('upload');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Instant Quote Generator</h2>
          <p className="text-sm text-muted-foreground">
            Take a photo → Get 3D model, price, BOM & cutting lists in seconds
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-2 ${currentStep === 'upload' ? 'text-blue-600' : 'text-green-600'}`}>
          {currentStep === 'upload' ? (
            <div className="h-6 w-6 rounded-full border-2 border-blue-600 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-blue-600" />
            </div>
          ) : (
            <CheckCircle2 className="h-6 w-6" />
          )}
          <span className="font-medium">Upload Photo</span>
        </div>
        <div className="flex-1 h-px bg-gray-300" />
        <div className={`flex items-center gap-2 ${currentStep === 'analyzing' ? 'text-blue-600' : currentStep === 'results' ? 'text-green-600' : 'text-gray-400'}`}>
          {currentStep === 'analyzing' ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : currentStep === 'results' ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
          )}
          <span className="font-medium">AI Analysis</span>
        </div>
        <div className="flex-1 h-px bg-gray-300" />
        <div className={`flex items-center gap-2 ${currentStep === 'results' ? 'text-green-600' : 'text-gray-400'}`}>
          {currentStep === 'results' ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
          )}
          <span className="font-medium">Quote Ready</span>
        </div>
      </div>

      {/* Upload Section */}
      {currentStep === 'upload' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Photo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Photo Upload
              </CardTitle>
              <CardDescription>
                Take or upload a photo of the door/window
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {imagePreview ? (
                <div className="space-y-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-64 object-cover rounded-lg border"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Change Photo
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-sm font-medium mb-1">Click to upload photo</p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG up to 10MB
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Optional Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Fire rated oak door with vision panel"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Dimensions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Dimensions
              </CardTitle>
              <CardDescription>
                Enter the size of the product (mm)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="width">Width (mm)</Label>
                <Input
                  id="width"
                  type="number"
                  value={dimensions.width}
                  onChange={(e) => setDimensions({ ...dimensions, width: parseFloat(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="height">Height (mm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={dimensions.height}
                  onChange={(e) => setDimensions({ ...dimensions, height: parseFloat(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="depth">Depth/Thickness (mm)</Label>
                <Input
                  id="depth"
                  type="number"
                  value={dimensions.depth}
                  onChange={(e) => setDimensions({ ...dimensions, depth: parseFloat(e.target.value) })}
                />
              </div>

              <Separator />

              <Button
                className="w-full"
                onClick={handleGenerateQuote}
                disabled={loading || (!imageBase64 && !description)}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Instant Quote
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analyzing State */}
      {currentStep === 'analyzing' && (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-blue-600" />
            <h3 className="text-xl font-semibold mb-2">Analyzing Product...</h3>
            <p className="text-muted-foreground">
              AI is matching your photo to product templates, generating components, calculating BOM and pricing...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {currentStep === 'results' && result && (
        <div className="space-y-6">
          {/* Product Match */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Product Match</CardTitle>
                  <CardDescription>{result.analysis.description}</CardDescription>
                </div>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  {(result.analysis.confidence * 100).toFixed(0)}% Confidence
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <span className="font-mono font-semibold">{result.analysis.productType}</span>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Pricing Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Material Cost:</span>
                  <span className="font-semibold">£{result.pricing.materialCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Labour Cost:</span>
                  <span className="font-semibold">£{result.pricing.labourCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Production Time:</span>
                  <span className="font-semibold">{result.pricing.totalTime} mins</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-bold">Total Price:</span>
                  <span className="font-bold text-green-600">£{result.pricing.totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Components & BOM */}
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Components ({result.components.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {result.components.map((comp, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">{comp.code}</span>
                      <span className="text-xs text-muted-foreground">
                        {comp.dimensions.width.toFixed(0)}×{comp.dimensions.height.toFixed(0)}×{comp.dimensions.depth.toFixed(0)}mm
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Cutting List
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {result.cuttingList.map((cut, idx) => (
                    <div key={idx} className="p-2 bg-gray-50 rounded text-xs">
                      <div className="font-semibold">{cut.componentName}</div>
                      <div className="text-muted-foreground">
                        L: {cut.length.toFixed(0)}mm × W: {cut.width.toFixed(0)}mm × T: {cut.thickness.toFixed(0)}mm
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Processes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Manufacturing Processes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.processes.map((process, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{process.sequence}</Badge>
                      <span className="font-medium">{process.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{process.duration} mins</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setResult(null);
                setCurrentStep('upload');
              }}
            >
              Start New Quote
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreateQuoteLine}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Add to Quote
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
