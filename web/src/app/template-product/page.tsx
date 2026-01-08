'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import TemplateProductGenerator, { type GeneratedBOM } from '../_components/TemplateProductGenerator';
import { ArrowLeft, Check } from 'lucide-react';

/**
 * Template Product Page
 *
 * Demonstrates the complete workflow:
 * 1. User selects a ProductType template
 * 2. Fills in field values (dimensions, materials, etc.)
 * 3. Previews the generated BOM
 * 4. Creates the BOM for use in quotes
 *
 * This replaces manual component configuration and works for:
 * - Fire doors (bulk, 223-column spreadsheet)
 * - Bespoke windows/doors (custom one-offs)
 * - AI-generated products (upload image → auto-suggest components)
 */
const TemplateProductPage: React.FC = () => {
  const router = useRouter();

  const handleBOMGenerated = (bom: GeneratedBOM) => {
    console.log('BOM Generated:', bom);
    // In a real app, you'd:
    // 1. Create a Quote with this BOM
    // 2. Store the BOM for later editing
    // 3. Navigate to quote builder or confirmation page
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Create Product from Template</h1>
          <p className="text-lg text-gray-600">
            Select a standard product configuration (fire door, casement window, etc.), customize
            dimensions and materials, and generate a complete bill of materials with pricing.
          </p>
        </div>

        {/* Template Generator */}
        <TemplateProductGenerator onBOMGenerated={handleBOMGenerated} />

        {/* Info Section */}
        <div className="mt-12 p-6 bg-white border border-gray-200 rounded-lg space-y-4">
          <h2 className="text-2xl font-bold">How It Works</h2>
          <ol className="space-y-3 list-decimal list-inside">
            <li className="text-gray-700">
              <strong>Select a Product Type:</strong> Choose from standard configurations like
              "FD30 Single Door" or "Casement Window 1200x1500"
            </li>
            <li className="text-gray-700">
              <strong>Configure Your Product:</strong> Fill in dimensions (height, width), select
              materials (timber type, glass specification, hinges, etc.)
            </li>
            <li className="text-gray-700">
              <strong>Review Components:</strong> The system automatically calculates what
              components you need and their quantities based on your selections
            </li>
            <li className="text-gray-700">
              <strong>View Pricing:</strong> See the total cost with your configured markup
              percentages and material surcharges
            </li>
            <li className="text-gray-700">
              <strong>Generate BOM:</strong> Create the final bill of materials ready for
              manufacturing, ordering, and quoting
            </li>
          </ol>
        </div>

        {/* Features Section */}
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
          <h2 className="text-2xl font-bold">Features</h2>
          <ul className="space-y-2 list-disc list-inside text-gray-700">
            <li>
              <strong>Instant BOM Generation:</strong> No manual component selection needed
            </li>
            <li>
              <strong>Real-time Pricing:</strong> Automatic cost calculation with your markups
            </li>
            <li>
              <strong>Material Substitution:</strong> Change materials and costs update instantly
            </li>
            <li>
              <strong>3D-Ready:</strong> Generated BOMs include 3D rendering data (textures,
              colors, materials)
            </li>
            <li>
              <strong>Flexible Markup:</strong> Per-material markup percentages and labour rates
            </li>
            <li>
              <strong>Batch Processing:</strong> Fire door grid can generate hundreds of BOMs at
              once
            </li>
            <li>
              <strong>AI Integration:</strong> Upload product image → AI suggests component list
              → matches to templates
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TemplateProductPage;
