"use client";
import React, { useState } from "react";

export interface NewFieldPayload {
  label: string;
  type: "text" | "number" | "select" | "boolean";
  required: boolean;
  costingInputKey?: string;
  options?: string[]; // only for select
  scope?: "client" | "item" | "quote_details" | "manufacturing" | "fire_door_schedule" | "fire_door_line_items" | "public" | "internal";
  showInPublicForm?: boolean;
  showInQuote?: boolean;
  isHidden?: boolean;
  isActive?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (data: NewFieldPayload) => Promise<void> | void;
  defaultScope?: "client" | "item" | "quote_details" | "manufacturing" | "fire_door_schedule" | "fire_door_line_items" | "public" | "internal";
}

const TYPES = ["text", "number", "select", "boolean"] as const;

const SCOPE_OPTIONS: Array<NonNullable<NewFieldPayload["scope"]>> = [
  "client",
  "item",
  "quote_details",
  "manufacturing",
  "fire_door_schedule",
  "fire_door_line_items",
  "public",
  "internal",
];

export const CreateQuestionnaireFieldModal: React.FC<Props> = ({ open, onClose, onCreate, defaultScope = "public" }) => {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<NewFieldPayload["type"]>("text");
  const [required, setRequired] = useState(false);
  const [costKey, setCostKey] = useState("");
  const [optionsText, setOptionsText] = useState("[") // encourage JSON entry
  const [scope, setScope] = useState<NonNullable<NewFieldPayload["scope"]>>(defaultScope);
  const [showInPublicForm, setShowInPublicForm] = useState<boolean>(defaultScope === 'public' || defaultScope === 'client');
  const [showInQuote, setShowInQuote] = useState<boolean>(true);
  const [isHidden, setIsHidden] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setLabel("");
    setType("text");
    setRequired(false);
    setCostKey("");
    setOptionsText("[");
    setScope(defaultScope);
    setShowInPublicForm(defaultScope === 'public' || defaultScope === 'client');
    setShowInQuote(true);
    setIsHidden(false);
    setIsActive(true);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError("Label required");
      return;
    }
    let options: string[] | undefined;
    if (type === "select") {
      try {
        const parsed = JSON.parse(optionsText || "[]");
        if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) {
          setError("Options must be JSON string array");
          return;
        }
        options = parsed;
      } catch (err: any) {
        setError("Invalid JSON for options");
        return;
      }
    }
    setSaving(true);
    try {
      await onCreate({ 
        label: label.trim(), 
        type: type.toUpperCase() as any, // Convert to uppercase to match Prisma enum
        required, 
        costingInputKey: costKey.trim() || undefined, 
        options, 
        scope,
        showInPublicForm,
        showInQuote,
        isHidden,
        isActive,
      });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl space-y-3"
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold">New Questionnaire Field</h2>
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="text-xs px-2 py-1 rounded hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <label className="block text-xs space-y-1">
          <span className="font-medium">Label</span>
          <input
            className="w-full rounded border px-2 py-1 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Door Height (mm)"
          />
        </label>
        <label className="block text-xs space-y-1">
          <span className="font-medium">Type</span>
          <select
            className="w-full rounded border px-2 py-1 text-sm bg-white"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs space-y-1">
          <span className="font-medium">Scope</span>
          <select
            className="w-full rounded border px-2 py-1 text-sm bg-white"
            value={scope}
            onChange={(e) => {
              const next = e.target.value as any;
              setScope(next);
              // Sensible defaults for public-estimate scopes
              if (next === 'public' || next === 'client') {
                setShowInPublicForm(true);
              }
            }}
          >
            {SCOPE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {type === "select" && (
          <label className="block text-xs space-y-1">
            <span className="font-medium">Options (JSON array)</span>
            <textarea
              rows={4}
              className="w-full rounded border px-2 py-1 text-xs font-mono"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder='["Option A", "Option B"]'
            />
          </label>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="h-4 w-4"
              />
              Required
            </label>
            <label className="flex-1 text-xs ml-4 space-y-1">
              <span className="font-medium">Costing Key (optional)</span>
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                value={costKey}
                onChange={(e) => setCostKey(e.target.value)}
                placeholder="e.g. height_mm"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={showInPublicForm}
                onChange={(e) => setShowInPublicForm(e.target.checked)}
                className="h-4 w-4"
              />
              Ask in public estimate
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={showInQuote}
                onChange={(e) => setShowInQuote(e.target.checked)}
                className="h-4 w-4"
              />
              Show to client on quote
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={isHidden}
                onChange={(e) => setIsHidden(e.target.checked)}
                className="h-4 w-4"
              />
              Hidden
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4"
              />
              Active
            </label>
          </div>
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <div className="pt-2 flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="text-xs px-3 py-1 rounded border bg-white hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuestionnaireFieldModal;
