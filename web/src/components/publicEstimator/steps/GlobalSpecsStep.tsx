/**
 * GlobalSpecsStep - Global specifications for all items
 * Timber type, glass specifications, finish, accessibility
 */

'use client';

import { useState } from 'react';
import { Trees, Sparkles, Palette, Accessibility } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GlobalSpecs {
  timberType?: string;
  glassType?: string;
  finish?: string;
  accessibility?: string[];
}

interface GlobalSpecsStepProps {
  globalSpecs?: GlobalSpecs;
  primaryColor?: string;
  onChange: (data: { globalSpecs: GlobalSpecs }) => void;
  onNext: () => void;
  onBack: () => void;
}

const TIMBER_OPTIONS = [
  { value: 'engineered_oak', label: 'Engineered Oak', description: 'Premium stability, natural grain' },
  { value: 'solid_oak', label: 'Solid Oak', description: 'Traditional, hardwearing' },
  { value: 'accoya', label: 'Accoya', description: 'Modified softwood, highly durable' },
  { value: 'sapele', label: 'Sapele', description: 'Mahogany alternative, rich color' },
  { value: 'idigbo', label: 'Idigbo', description: 'Stable, paint-grade' },
  { value: 'other', label: 'Not sure / Other', description: 'We can advise' },
];

const GLASS_OPTIONS = [
  { value: 'double_glazed', label: 'Double Glazed', description: 'Standard energy efficiency' },
  { value: 'triple_glazed', label: 'Triple Glazed', description: 'Premium insulation' },
  { value: 'obscure', label: 'Obscure Glass', description: 'Privacy with light' },
  { value: 'toughened', label: 'Toughened', description: 'Safety glass' },
  { value: 'leaded', label: 'Leaded / Decorative', description: 'Traditional or custom design' },
  { value: 'none', label: 'No glass', description: 'Solid panels' },
  { value: 'other', label: 'Not sure / Other', description: 'We can advise' },
];

const FINISH_OPTIONS = [
  { value: 'factory_finished', label: 'Factory Finished', description: 'Primed or painted, ready to install' },
  { value: 'primed', label: 'Primed Only', description: 'Ready for your painter' },
  { value: 'stained', label: 'Stained', description: 'Natural wood with color' },
  { value: 'painted_white', label: 'Painted White', description: 'Classic factory finish' },
  { value: 'painted_custom', label: 'Custom Paint Color', description: 'Any RAL or BS color' },
  { value: 'natural', label: 'Natural / Unfinished', description: 'Bare timber' },
  { value: 'other', label: 'Not sure / Other', description: 'We can advise' },
];

const ACCESSIBILITY_OPTIONS = [
  { value: 'level_threshold', label: 'Level Threshold', description: 'Wheelchair / step-free access' },
  { value: 'wider_opening', label: 'Wider Opening', description: 'Increased clear width' },
  { value: 'easy_operation', label: 'Easy Operation', description: 'Low-force handles/mechanisms' },
  { value: 'contrasting_color', label: 'Contrasting Color', description: 'Visual accessibility' },
];

export function GlobalSpecsStep({
  globalSpecs = {},
  primaryColor = '#3b82f6',
  onChange,
  onNext,
  onBack,
}: GlobalSpecsStepProps) {
  const [specs, setSpecs] = useState<GlobalSpecs>(globalSpecs);

  const handleUpdate = (field: keyof GlobalSpecs, value: string | string[]) => {
    const updated = { ...specs, [field]: value };
    setSpecs(updated);
    onChange({ globalSpecs: updated });
  };

  const toggleAccessibility = (value: string) => {
    const current = specs.accessibility || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    handleUpdate('accessibility', updated);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Specification preferences</h2>
        <p className="mt-2 text-slate-600">
          Select your preferences for materials and finish. Don't worry if you're unsure - we can discuss these during your consultation.
        </p>
      </div>

      {/* Timber type */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Trees className="h-5 w-5" style={{ color: primaryColor }} />
          <h3 className="text-lg font-semibold text-slate-900">Timber Type</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TIMBER_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => handleUpdate('timberType', option.value)}
              className={`rounded-2xl border-2 p-4 text-left transition ${
                specs.timberType === option.value
                  ? 'border-current bg-opacity-5'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              style={
                specs.timberType === option.value
                  ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` }
                  : {}
              }
            >
              <div className="font-medium text-slate-900">{option.label}</div>
              <div className="mt-1 text-sm text-slate-500">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Glass type */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5" style={{ color: primaryColor }} />
          <h3 className="text-lg font-semibold text-slate-900">Glass Specification</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {GLASS_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => handleUpdate('glassType', option.value)}
              className={`rounded-2xl border-2 p-4 text-left transition ${
                specs.glassType === option.value
                  ? 'border-current bg-opacity-5'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              style={
                specs.glassType === option.value
                  ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` }
                  : {}
              }
            >
              <div className="font-medium text-slate-900">{option.label}</div>
              <div className="mt-1 text-sm text-slate-500">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Finish */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Palette className="h-5 w-5" style={{ color: primaryColor }} />
          <h3 className="text-lg font-semibold text-slate-900">Finish</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FINISH_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => handleUpdate('finish', option.value)}
              className={`rounded-2xl border-2 p-4 text-left transition ${
                specs.finish === option.value
                  ? 'border-current bg-opacity-5'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              style={
                specs.finish === option.value
                  ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` }
                  : {}
              }
            >
              <div className="font-medium text-slate-900">{option.label}</div>
              <div className="mt-1 text-sm text-slate-500">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Accessibility */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Accessibility className="h-5 w-5" style={{ color: primaryColor }} />
          <h3 className="text-lg font-semibold text-slate-900">Accessibility Requirements</h3>
          <span className="text-sm text-slate-500">(optional, select all that apply)</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {ACCESSIBILITY_OPTIONS.map(option => {
            const isSelected = specs.accessibility?.includes(option.value) || false;
            return (
              <button
                key={option.value}
                onClick={() => toggleAccessibility(option.value)}
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  isSelected
                    ? 'border-current bg-opacity-5'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                style={
                  isSelected
                    ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` }
                    : {}
                }
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 ${
                      isSelected ? 'border-current' : 'border-slate-300'
                    }`}
                    style={isSelected ? { borderColor: primaryColor, backgroundColor: primaryColor } : {}}
                  >
                    {isSelected && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{option.label}</div>
                    <div className="mt-1 text-sm text-slate-500">{option.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Help text */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">
          <strong>Not sure what to choose?</strong> These selections help us provide an accurate estimate, but we'll discuss all options in detail during your consultation. You can always change your mind later.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex-1 rounded-2xl border-2 py-6 text-base"
        >
          Back
        </Button>
        <Button
          onClick={onNext}
          className="flex-1 rounded-2xl py-6 text-base text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
