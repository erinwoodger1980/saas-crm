/**
 * AI Description Panel
 * 
 * Simple UI for entering product description and triggering AI template generation
 * Designed to integrate into existing ProductConfigurator3D header
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2, Sparkles, Upload } from 'lucide-react';

export interface AIDescriptionPanelProps {
  onGenerate: (description: string, imageBase64?: string) => void;
  loading?: boolean;
  error?: string | null;
}

export function AIDescriptionPanel({ onGenerate, loading, error }: AIDescriptionPanelProps) {
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const handleSubmit = async () => {
    if (!description.trim()) return;
    
    let imageBase64: string | undefined;
    
    if (imageFile) {
      // Convert image to base64
      const reader = new FileReader();
      imageBase64 = await new Promise((resolve) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1]; // Remove data:image/...;base64, prefix
          resolve(base64Data);
        };
        reader.readAsDataURL(imageFile);
      });
    }
    
    onGenerate(description, imageBase64);
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };
  
  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <Label htmlFor="ai-description" className="text-sm font-medium">
            Describe your product
          </Label>
        </div>
        <Textarea
          id="ai-description"
          placeholder="E.g., Oak entrance door, half glazed with stained glass, bolection moldings, Winkhaus lock, chrome handle..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          rows={3}
          className="resize-none"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="ai-image" className="text-sm font-medium">
          Upload reference image (optional)
        </Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('ai-image')?.click()}
            disabled={loading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {imageFile ? imageFile.name : 'Choose image'}
          </Button>
          <input
            id="ai-image"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
        </div>
      </div>
      
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
      
      <Button
        onClick={handleSubmit}
        disabled={loading || !description.trim()}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Product
          </>
        )}
      </Button>
      
      <div className="text-xs text-gray-500 space-y-1">
        <p>AI will detect:</p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>Dimensions (wide, tall, narrow)</li>
          <li>Materials (oak, accoya, painted white)</li>
          <li>Glazing (half glass, full glass, solid)</li>
          <li>Features (bolection, mullions, panels)</li>
          <li>Hardware (Winkhaus lock, chrome handles)</li>
        </ul>
      </div>
    </Card>
  );
}

/**
 * Example integration into ProductConfigurator3D:
 * 
 * import { AIDescriptionPanel } from './AIDescriptionPanel';
 * import { useAIConfigurator } from '@/hooks/useAIConfigurator';
 * 
 * // Inside component:
 * const aiConfig = useAIConfigurator({
 *   onSceneChange: (scene) => setConfig(scene),
 * });
 * 
 * // In render:
 * <Sheet>
 *   <SheetTrigger asChild>
 *     <Button variant="outline" size="sm">
 *       <Sparkles className="h-4 w-4 mr-2" />
 *       AI Generate
 *     </Button>
 *   </SheetTrigger>
 *   <SheetContent side="right" className="w-96 overflow-y-auto">
 *     <AIDescriptionPanel
 *       onGenerate={aiConfig.generateFromDescription}
 *       loading={aiConfig.loading}
 *       error={aiConfig.error}
 *     />
 *   </SheetContent>
 * </Sheet>
 */
