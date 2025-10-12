"use client";

import * as React from "react";

export type QField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  required?: boolean;
  options?: string[];
};

export function QuestionFields({
  fields,
  values,
  onChange,
  layout = "grid",
}: {
  fields: QField[];
  values: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  layout?: "grid" | "stack";
}) {
  const setVal = (k: string, v: any) => onChange({ ...values, [k]: v });

  return (
    <div className={layout === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-3"}>
      {fields.map((f) => {
        const v = values?.[f.key] ?? "";
        return (
          <label key={f.key} className="block">
            <div className="mb-1 text-xs text-slate-600">
              {f.label} {f.required ? <span className="text-red-500">*</span> : null}
            </div>

            {f.type === "textarea" ? (
              <textarea
                className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
                value={v}
                required={!!f.required}
                onChange={(e) => setVal(f.key, e.target.value)}
              />
            ) : f.type === "select" ? (
              <select
                className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
                value={v}
                required={!!f.required}
                onChange={(e) => setVal(f.key, e.target.value)}
              >
                <option value="" disabled>
                  Select…
                </option>
                {(f.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
                type={f.type === "number" ? "number" : "text"}
                value={v}
                required={!!f.required}
                onChange={(e) => setVal(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}