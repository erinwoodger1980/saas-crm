// src/components/questionnaire/DynamicQuoteForm.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Save, AlertCircle } from "lucide-react";

interface QuestionnaireField {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  config?: any;
  sortOrder: number;
  costingInputKey?: string;
}

interface Answer {
  fieldId: string;
  value: string;
}

interface DynamicQuoteFormProps {
  quoteId: string;
  onSave?: (answers: Answer[]) => void;
  onComplete?: () => void;
}

export default function DynamicQuoteForm({
  quoteId,
  onSave,
  onComplete,
}: DynamicQuoteFormProps) {
  const [fields, setFields] = useState<QuestionnaireField[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchFieldsAndAnswers = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch field definitions
      const fieldsRes = await fetch("/api/questionnaire-fields");
      if (!fieldsRes.ok) throw new Error("Failed to fetch fields");
      const fieldsData = await fieldsRes.json();
      setFields(fieldsData);

      // Fetch existing answers
      const answersRes = await fetch(`/api/questionnaire-responses/quote/${quoteId}`);
      if (!answersRes.ok) throw new Error("Failed to fetch answers");
      const answersData = await answersRes.json();

      if (answersData.answers) {
        const answerMap: Record<string, string> = {};
        answersData.answers.forEach((a: any) => {
          answerMap[a.fieldId] = a.value || "";
        });
        setAnswers(answerMap);
      }
    } catch (err) {
      console.error("Failed to fetch form data:", err);
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    fetchFieldsAndAnswers();
  }, [fetchFieldsAndAnswers]);

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      if (field.required && !answers[field.id]) {
        newErrors[field.id] = `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave(markComplete = false) {
    if (markComplete && !validateForm()) {
      return;
    }

    try {
      setSaving(true);

      const payload = {
        answers: fields.map((field) => ({
          fieldId: field.id,
          value: answers[field.id] || null,
        })),
        completed: markComplete,
      };

      const res = await fetch(`/api/questionnaire-responses/quote/${quoteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }

      if (onSave) {
        onSave(payload.answers);
      }

      if (markComplete && onComplete) {
        onComplete();
      }
    } catch (err: any) {
      alert(err.message || "Failed to save questionnaire");
    } finally {
      setSaving(false);
    }
  }

  function handleChange(fieldId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldId];
      return newErrors;
    });
  }

  function renderField(field: QuestionnaireField) {
    const value = answers[field.id] || "";
    const error = errors[field.id];

    const baseClasses =
      "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none";
    const errorClasses = error ? "border-red-500" : "border-gray-300";

    const label = (
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
    );

    const helpText = field.helpText && (
      <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
    );

    const errorMsg = error && (
      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    );

    switch (field.type) {
      case "text":
        return (
          <div key={field.id}>
            {label}
            <input
              type="text"
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className={`${baseClasses} ${errorClasses}`}
            />
            {helpText}
            {errorMsg}
          </div>
        );

      case "number":
        return (
          <div key={field.id}>
            {label}
            <input
              type="number"
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className={`${baseClasses} ${errorClasses}`}
            />
            {helpText}
            {errorMsg}
          </div>
        );

      case "textarea":
        return (
          <div key={field.id}>
            {label}
            <textarea
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
              className={`${baseClasses} ${errorClasses}`}
            />
            {helpText}
            {errorMsg}
          </div>
        );

      case "select":
        const options = field.config?.options || [];
        return (
          <div key={field.id}>
            {label}
            <select
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              className={`${baseClasses} ${errorClasses}`}
            >
              <option value="">-- Select --</option>
              {options.map((opt: string) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {helpText}
            {errorMsg}
          </div>
        );

      case "boolean":
        return (
          <div key={field.id}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={value === "true"}
                onChange={(e) => handleChange(field.id, e.target.checked ? "true" : "false")}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </span>
            </label>
            {helpText}
            {errorMsg}
          </div>
        );

      case "date":
        return (
          <div key={field.id}>
            {label}
            <input
              type="date"
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              className={`${baseClasses} ${errorClasses}`}
            />
            {helpText}
            {errorMsg}
          </div>
        );

      default:
        return null;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-gray-500">Loading form...</div>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No questionnaire fields configured yet.</p>
        <p className="text-sm mt-2">Contact your administrator to set up quote form fields.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Project Details</h3>
        <p className="text-sm text-gray-600">
          Fill in the details below to help us provide an accurate quote
        </p>
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.id}>{renderField(field)}</div>
        ))}
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}
