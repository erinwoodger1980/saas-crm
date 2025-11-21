/**
 * Property & Project Basics step.
 * Captures property type, number of items, timeframe, budget.
 */

import { useState } from 'react';
import { Home, Warehouse, Building, Calendar, Coins, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PropertyBasicsStepProps {
  propertyType?: string;
  itemCount?: number;
  timeframe?: string;
  budget?: string;
  primaryColor?: string;
  onChange: (data: {
    propertyType?: string;
    itemCount?: number;
    timeframe?: string;
    budget?: string;
  }) => void;
  onNext: () => void;
  onBack: () => void;
}

const PROPERTY_TYPES = [
  { value: 'house', label: 'House', icon: <Home className="h-6 w-6" /> },
  { value: 'flat', label: 'Flat / Apartment', icon: <Building className="h-6 w-6" /> },
  { value: 'commercial', label: 'Commercial', icon: <Warehouse className="h-6 w-6" /> },
];

const TIMEFRAMES = [
  'Within 3 months',
  '3-6 months',
  '6-12 months',
  'Just exploring',
];

const BUDGETS = [
  'Under £5,000',
  '£5,000 - £10,000',
  '£10,000 - £20,000',
  '£20,000 - £50,000',
  'Over £50,000',
  'Not sure yet',
];

export function PropertyBasicsStep({
  propertyType = '',
  itemCount = 1,
  timeframe = '',
  budget = '',
  primaryColor = '#3b82f6',
  onChange,
  onNext,
  onBack,
}: PropertyBasicsStepProps) {
  const [touched, setTouched] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (propertyType && itemCount) {
      onNext();
    }
  };

  const isValid = propertyType && itemCount >= 1;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Property Type */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          What type of property? <span className="text-red-500">*</span>
        </Label>
        <div className="grid gap-3">
          {PROPERTY_TYPES.map((type) => (
            <label
              key={type.value}
              className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition-all ${
                propertyType === type.value
                  ? 'border-current shadow-sm'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              style={propertyType === type.value ? { borderColor: primaryColor } : {}}
            >
              <input
                type="radio"
                name="propertyType"
                value={type.value}
                checked={propertyType === type.value}
                onChange={(e) => onChange({ propertyType: e.target.value })}
                className="sr-only"
              />
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  propertyType === type.value ? 'text-white' : 'text-slate-400'
                }`}
                style={
                  propertyType === type.value
                    ? { backgroundColor: primaryColor }
                    : { backgroundColor: '#f1f5f9' }
                }
              >
                {type.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-slate-900">{type.label}</div>
              </div>
            </label>
          ))}
        </div>
        {touched && !propertyType && (
          <p className="text-sm text-red-600">Please select a property type</p>
        )}
      </div>

      {/* Item Count */}
      <div className="space-y-3">
        <Label htmlFor="itemCount" className="text-base font-semibold">
          How many windows/doors? <span className="text-red-500">*</span>
        </Label>
        <Select
          value={String(itemCount)}
          onValueChange={(value) => onChange({ itemCount: parseInt(value, 10) })}
        >
          <SelectTrigger
            id="itemCount"
            className="h-14 rounded-2xl border-2 border-slate-200 text-base"
          >
            <SelectValue placeholder="Select number of items" />
          </SelectTrigger>
          <SelectContent>
            {[...Array(20)].map((_, i) => {
              const num = i + 1;
              return (
                <SelectItem key={num} value={String(num)}>
                  {num} {num === 1 ? 'item' : 'items'}
                </SelectItem>
              );
            })}
            <SelectItem value="20+">20+ items</SelectItem>
          </SelectContent>
        </Select>
        {touched && !itemCount && (
          <p className="text-sm text-red-600">Please select number of items</p>
        )}
      </div>

      {/* Timeframe */}
      <div className="space-y-3">
        <Label htmlFor="timeframe" className="text-base font-semibold">
          <Calendar className="mr-2 inline h-4 w-4" />
          When are you looking to start?
        </Label>
        <Select value={timeframe} onValueChange={(value) => onChange({ timeframe: value })}>
          <SelectTrigger
            id="timeframe"
            className="h-14 rounded-2xl border-2 border-slate-200 text-base"
          >
            <SelectValue placeholder="Select timeframe" />
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAMES.map((tf) => (
              <SelectItem key={tf} value={tf}>
                {tf}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Budget */}
      <div className="space-y-3">
        <Label htmlFor="budget" className="text-base font-semibold">
          <Coins className="mr-2 inline h-4 w-4" />
          Rough budget (optional)
        </Label>
        <Select value={budget} onValueChange={(value) => onChange({ budget: value })}>
          <SelectTrigger
            id="budget"
            className="h-14 rounded-2xl border-2 border-slate-200 text-base"
          >
            <SelectValue placeholder="Select budget range" />
          </SelectTrigger>
          <SelectContent>
            {BUDGETS.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">
          Helps us tailor recommendations to your needs
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="submit"
          size="lg"
          className="flex-1 gap-2"
          style={{ backgroundColor: primaryColor }}
          disabled={!isValid}
        >
          Next
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </form>
  );
}
