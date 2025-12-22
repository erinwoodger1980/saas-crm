/**
 * Dynamic Field Renderer Component
 * Renders fields based on context and configuration
 * Handles display, validation, and value management
 */

'use client';

import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X, Check } from 'lucide-react';

// Type definitions - matches Prisma QuestionnaireField schema
interface QuestionnaireField {
  id: string;
  key: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'TEXTAREA' | 'DATE';
  scope: string;
  isActive: boolean;
  isStandard: boolean;
  helpText?: string | null;
  placeholder?: string | null;
  unit?: string | null;
  required?: boolean | null;
  readOnly?: boolean | null;
  minValue?: number | null;
  maxValue?: number | null;
  minLength?: number | null;
  maxLength?: number | null;
  defaultValue?: string | null;
  options?: Array<{ value: string; label: string }> | null;
  displayContexts?: string[] | null;
}

interface FieldRendererProps {
  field: QuestionnaireField;
  value?: any;
  onChange?: (value: any) => void;
  onBlur?: (value: any) => void;
  context?: string;
  disabled?: boolean;
  error?: string;
  showLabel?: boolean;
  showDescription?: boolean;
}

/**
 * Renders a single field based on its type and configuration
 */
export function FieldRenderer({
  field,
  value,
  onChange,
  onBlur,
  context,
  disabled = false,
  error,
  showLabel = true,
  showDescription = true,
}: FieldRendererProps) {
  // Check if field should be visible in this context
  const isVisibleInContext = useMemo(() => {
    if (!context) return true;

    // Check display contexts
    if (field.displayContexts && Array.isArray(field.displayContexts)) {
      return field.displayContexts.includes(context);
    }

    return true;
  }, [field, context]);

  if (!isVisibleInContext) return null;

  const fieldId = `field-${field.id}`;
  const isReadOnly = field.readOnly || disabled;

  // Get options from field.options (stored as JSON in database)
  const options = Array.isArray(field.options) ? field.options : [];

  // Render based on field type
  const renderInput = () => {
    switch (field.type) {
      case 'TEXT':
        return (
          <Input
            id={fieldId}
            type="text"
            placeholder={field.placeholder || ''}
            value={value || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => onBlur?.(e.target.value)}
            disabled={isReadOnly}
            className={error ? 'border-red-500' : ''}
          />
        );

      case 'NUMBER':
        return (
          <Input
            id={fieldId}
            type="number"
            placeholder={field.placeholder || ''}
            value={value || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange?.(parseFloat(e.target.value) || null)}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => onBlur?.(parseFloat(e.target.value) || null)}
            disabled={isReadOnly}
            className={error ? 'border-red-500' : ''}
          />
        );

      case 'TEXTAREA':
        return (
          <Textarea
            id={fieldId}
            placeholder={field.placeholder || ''}
            value={value || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value)}
            onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) => onBlur?.(e.target.value)}
            disabled={isReadOnly}
            rows={4}
            className={error ? 'border-red-500' : ''}
          />
        );

      case 'SELECT':
        return (
          <Select value={value || ''} onValueChange={(v: string) => onChange?.(v)} disabled={isReadOnly}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {options.map((option: any) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'BOOLEAN':
        return (
          <Checkbox
            id={fieldId}
            checked={value || false}
            onCheckedChange={onChange}
            disabled={isReadOnly}
          />
        );

      case 'DATE':
        return (
          <Input
            id={fieldId}
            type="date"
            value={value || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => onBlur?.(e.target.value)}
            disabled={isReadOnly}
            className={error ? 'border-red-500' : ''}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      {showLabel && (
        <Label htmlFor={fieldId} className="flex items-center gap-2">
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
          {field.unit && <span className="text-xs text-gray-500">({field.unit})</span>}
        </Label>
      )}

      {renderInput()}

      {showDescription && field.helpText && (
        <p className="text-xs text-slate-500">{field.helpText}</p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/**
 * Multi-field form renderer
 * Renders multiple fields organized by scope
 */
interface FieldFormProps {
  fields: QuestionnaireField[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  onBlur?: (fieldKey: string, value: any) => void;
  context?: string;
  disabled?: boolean;
  errors?: Record<string, string>;
  columns?: 1 | 2 | 3;
}

export function FieldForm({
  fields,
  values,
  onChange,
  onBlur,
  context,
  disabled = false,
  errors = {},
  columns = 2,
}: FieldFormProps) {
  // Group fields by scope
  const groupedFields = useMemo(() => {
    const groups: Record<string, typeof fields> = {};
    fields.forEach((field) => {
      const scope = field.scope || 'general';
      if (!groups[scope]) groups[scope] = [];
      groups[scope].push(field);
    });
    return groups;
  }, [fields]);

  const handleFieldChange = (fieldKey: string, newValue: any) => {
    const newValues = { ...values, [fieldKey]: newValue };
    onChange(newValues);
  };

  const handleFieldBlur = (fieldKey: string, value: any) => {
    onBlur?.(fieldKey, value);
  };

  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  }[columns];

  return (
    <div className="space-y-8">
      {Object.entries(groupedFields).map(([scope, scopeFields]) => (
        <fieldset key={scope} className="space-y-4">
          {scope !== 'general' && scope !== 'item' && (
            <legend className="text-lg font-semibold capitalize">{scope.replace('_', ' ')}</legend>
          )}

          <div className={`grid ${gridClass} gap-6`}>
            {scopeFields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={values[field.key]}
                onChange={(newValue) => handleFieldChange(field.key, newValue)}
                onBlur={(value) => handleFieldBlur(field.key, value)}
                context={context}
                disabled={disabled}
                error={errors[field.key]}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/**
 * Inline field editor for quick edits
 */
interface InlineFieldEditorProps {
  field: QuestionnaireField;
  value?: any;
  onSave: (value: any) => void;
  onCancel: () => void;
}

export function InlineFieldEditor({
  field,
  value,
  onSave,
  onCancel,
}: InlineFieldEditorProps) {
  const [editValue, setEditValue] = React.useState(value);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave?.(editValue);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <FieldRenderer
        field={field}
        value={editValue}
        onChange={setEditValue}
        disabled={false}
      />
      <Button
        onClick={handleSave}
        disabled={isSaving}
        size="sm"
      >
        <Check className="h-4 w-4" />
        {isSaving ? 'Saving...' : ''}
      </Button>
      <Button
        onClick={onCancel}
        variant="outline"
        size="sm"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
