"use client";
import React from "react";

export type UnifiedField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean" | "textarea" | "date" | string;
  required?: boolean;
  options?: string[] | null;
  placeholder?: string | null;
  helpText?: string | null;
  readOnly?: boolean;
};

function UnifiedNumberInput({
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: {
  value: any;
  onChange: (next: any) => void;
  placeholder: string;
  className: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = React.useState<string>(() => (value ?? "").toString());
  const focusedRef = React.useRef(false);

  const commit = React.useCallback(
    (raw: string) => {
      if (raw === "") {
        onChange(undefined);
        return;
      }
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) onChange(parsed);
    },
    [onChange]
  );

  React.useEffect(() => {
    if (focusedRef.current) return;
    setDraft((value ?? "").toString());
  }, [value]);

  React.useEffect(() => {
    if (!focusedRef.current) return;
    const t = window.setTimeout(() => commit(draft), 350);
    return () => window.clearTimeout(t);
  }, [draft, commit]);

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={draft}
      placeholder={placeholder}
      onFocus={(e) => {
        focusedRef.current = true;
        // Ensure the click caret placement doesn't override selection.
        requestAnimationFrame(() => e.currentTarget.select());
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit(draft);
      }}
      onChange={(e) => setDraft(e.target.value)}
      disabled={disabled}
    />
  );
}

export function UnifiedFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: UnifiedField;
  value: any;
  onChange: (next: any) => void;
}) {
  const { label, required, type, options, placeholder, helpText, readOnly } = field;

  const baseInput = "w-full rounded-2xl border bg-white/95 px-3 py-2 text-sm disabled:opacity-60";

  // Per-field estimator_step events removed to reduce noise; step events now emitted at step transitions.

  return (
    <label className="block text-xs">
      <div className="mb-1 font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-500 ml-1">*</span> : null}
      </div>
      {(() => {
        switch ((type || "text").toLowerCase()) {
          case "textarea":
            return (
              <textarea
                className={`${baseInput} min-h-[80px]`}
                value={value ?? ""}
                placeholder={placeholder ?? ""}
                onChange={(e) => { onChange(e.target.value); }}
                disabled={readOnly}
              />
            );
          case "number":
            return (
              <UnifiedNumberInput
                value={value}
                placeholder={placeholder ?? ""}
                className={baseInput}
                onChange={onChange}
                disabled={readOnly}
              />
            );
          case "select":
            return (
              <select
                className={`${baseInput} bg-white`}
                value={value ?? ""}
                onChange={(e) => { const next = e.target.value || undefined; onChange(next); }}
                disabled={readOnly}
              >
                <option value="">Select…</option>
                {(options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            );
          case "boolean":
            return (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!value}
                  onChange={(e) => { onChange(e.target.checked); }}
                  disabled={readOnly}
                />
                <span className="text-slate-600">{label}</span>
              </div>
            );
          case "date":
            return (
              <input
                type="date"
                className={baseInput}
                value={value ?? ""}
                onChange={(e) => { const next = e.target.value || undefined; onChange(next); }}
                disabled={readOnly}
              />
            );
          case "text":
          default:
            return (
              <input
                type="text"
                className={baseInput}
                value={value ?? ""}
                placeholder={placeholder ?? ""}
                onChange={(e) => { onChange(e.target.value); }}
                disabled={readOnly}
              />
            );
        }
      })()}
      {helpText ? <div className="mt-1 text-[11px] text-slate-500">{helpText}</div> : null}
    </label>
  );
}

export default UnifiedFieldRenderer;
