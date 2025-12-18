/**
 * Phase 3: QuestionSet Form Renderer
 * 
 * Dynamically renders a form based on a QuestionSet's questions
 * Handles visibility rules, required fields, and value changes
 */

'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Question {
  id: string;
  attributeCode: string;
  label: string;
  helpText?: string;
  placeholder?: string;
  controlType: 'input' | 'select' | 'radio' | 'checkbox' | 'slider' | 'date' | 'textarea';
  visibilityRules?: any;
  displayOrder: number;
  isActive: boolean;
}

interface QuestionSetQuestion {
  id: string;
  sortOrder: number;
  isRequired: boolean;
  question: Question;
}

interface Attribute {
  id: string;
  code: string;
  name: string;
  attributeType: string;
  unit?: string;
  options?: string[];
  defaultValue?: string;
  requiredForCosting: boolean;
  requiredForManufacture: boolean;
}

interface QuestionSetFormProps {
  questions: QuestionSetQuestion[];
  attributes: Record<string, Attribute>;
  values: Record<string, any>;
  onChange: (attributeCode: string, value: any) => void;
  completenessMode?: 'quote-ready' | 'manufacture-ready';
}

/**
 * Check if a question should be visible based on rules
 */
function isQuestionVisible(
  question: Question,
  currentValues: Record<string, any>
): boolean {
  if (!question.visibilityRules) return true;

  const { showWhen } = question.visibilityRules;
  if (!showWhen) return true;

  // Support: { productType: ['OPT_E03', 'TYPE_CASEMENT'] }
  if (showWhen.productType) {
    const selectedProductType = currentValues.productType;
    if (!selectedProductType) return false;
    return showWhen.productType.includes(selectedProductType);
  }

  // Support: { attributeCode: value }
  for (const [attrCode, expectedValue] of Object.entries(showWhen)) {
    if (currentValues[attrCode] !== expectedValue) return false;
  }

  return true;
}

/**
 * Calculate completeness indicator
 */
function calculateCompleteness(
  values: Record<string, any>,
  attributes: Record<string, Attribute>,
  mode: 'quote-ready' | 'manufacture-ready'
): { filled: number; required: number; percentage: number } {
  const requiredFlag = mode === 'manufacture-ready' ? 'requiredForManufacture' : 'requiredForCosting';
  
  let required = 0;
  let filled = 0;

  for (const attr of Object.values(attributes)) {
    if (attr[requiredFlag as keyof Attribute]) {
      required++;
      if (values[attr.code] !== undefined && values[attr.code] !== null && values[attr.code] !== '') {
        filled++;
      }
    }
  }

  return {
    filled,
    required,
    percentage: required > 0 ? Math.round((filled / required) * 100) : 100
  };
}

export default function QuestionSetForm({
  questions,
  attributes,
  values,
  onChange,
  completenessMode = 'quote-ready'
}: QuestionSetFormProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Filter visible questions
  const visibleQuestions = useMemo(
    () => questions.filter(qq => isQuestionVisible(qq.question, values)),
    [questions, values]
  );

  // Group by attribute type
  const groupedQuestions = useMemo(
    () => {
      const groups: Record<string, QuestionSetQuestion[]> = {};
      for (const qq of visibleQuestions) {
        const type = attributes[qq.question.attributeCode]?.attributeType || 'other';
        if (!groups[type]) groups[type] = [];
        groups[type].push(qq);
      }
      return groups;
    },
    [visibleQuestions, attributes]
  );

  const completeness = useMemo(
    () => calculateCompleteness(values, attributes, completenessMode),
    [values, attributes, completenessMode]
  );

  const renderInput = (question: Question, attribute: Attribute) => {
    const value = values[attribute.code] ?? attribute.defaultValue ?? '';

    switch (question.controlType) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => onChange(attribute.code, e.target.value)}
            placeholder={question.placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onChange(attribute.code, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select an option...</option>
            {(attribute.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {(attribute.options || []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={attribute.code}
                  value={opt}
                  checked={value === opt}
                  onChange={(e) => onChange(attribute.code, e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {(attribute.options || []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  value={opt}
                  checked={Array.isArray(value) ? value.includes(opt) : false}
                  onChange={(e) => {
                    const arr = Array.isArray(value) ? [...value] : [];
                    if (e.target.checked) {
                      arr.push(opt);
                    } else {
                      arr.splice(arr.indexOf(opt), 1);
                    }
                    onChange(attribute.code, arr);
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(attribute.code, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );

      case 'slider':
        const hints = attributes[attribute.code]?.hints as any || {};
        return (
          <div className="space-y-2">
            <input
              type="range"
              min={hints.min || 0}
              max={hints.max || 100}
              step={hints.step || 1}
              value={value || hints.min || 0}
              onChange={(e) => onChange(attribute.code, parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-sm text-gray-600">
              {value} {attribute.unit || ''}
            </div>
          </div>
        );

      case 'input':
      default:
        const hints2 = attributes[attribute.code]?.hints as any || {};
        return (
          <Input
            type={attribute.attributeType === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => onChange(attribute.code, e.target.value)}
            placeholder={question.placeholder}
            min={hints2.min}
            max={hints2.max}
            step={hints2.step}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Completeness Indicator */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-900">
            {completenessMode === 'manufacture-ready' ? 'Manufacture-Ready' : 'Quote-Ready'}
          </span>
          <span className="text-lg font-bold text-blue-600">{completeness.percentage}%</span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all"
            style={{ width: `${completeness.percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-2">
          {completeness.filled} of {completeness.required} required fields completed
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {visibleQuestions.map((qq) => {
          const attribute = attributes[qq.question.attributeCode];
          const isRequired = qq.isRequired || attribute?.requiredForCosting;
          const isManufactureRequired = attribute?.requiredForManufacture;

          return (
            <div
              key={qq.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <label className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {qq.question.label}
                  </span>
                  {isRequired && (
                    <span className="text-red-500 text-xs font-bold">*</span>
                  )}
                  {isManufactureRequired && !isRequired && (
                    <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded font-medium">
                      Mfg
                    </span>
                  )}
                </label>
                {attribute?.unit && (
                  <span className="text-xs text-gray-500">{attribute.unit}</span>
                )}
              </div>

              {qq.question.helpText && (
                <p className="text-xs text-gray-600 mb-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {qq.question.helpText}
                </p>
              )}

              <div className="mt-3">
                {renderInput(qq.question, attribute)}
              </div>
            </div>
          );
        })}
      </div>

      {visibleQuestions.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No questions available for the current selection</p>
        </div>
      )}
    </div>
  );
}

export { calculateCompleteness, isQuestionVisible };
