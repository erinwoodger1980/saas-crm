"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

// Minimal switch using checkbox; could be replaced by a dedicated shadcn/ui switch component if added later.
function BooleanSwitch({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      className={`inline-flex h-6 w-11 items-center rounded-full border transition-colors ${value ? "bg-blue-600 border-blue-600" : "bg-slate-200 border-slate-300"} ${disabled ? "opacity-50" : "cursor-pointer"}`}
      aria-pressed={value}
    >
      <span
        className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-1"}`}
      />
    </button>
  );
}

export type QuestionnaireField = {
  id?: string; // optional for pre-existing fields
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean" | string;
  required?: boolean;
  options?: string[] | null;
};

export interface DynamicQuestionnaireFormProps {
  fields: QuestionnaireField[];
  questionnaireId?: string; // if needed for backend association
  quoteId?: string; // Align with existing backend POST /questionnaire-responses/quote/:quoteId
  initialValues?: Record<string, any>;
  onSubmitted?: (result: any) => void;
  apiBase?: string; // NEXT_PUBLIC_API_URL fallback
  completed?: boolean; // mark response completed
}

/**
 * Renders dynamic questionnaire fields using react-hook-form. On submit, posts answers to backend.
 * Output values shape: { [field.key]: value }
 */
export const DynamicQuestionnaireForm: React.FC<DynamicQuestionnaireFormProps> = ({
  fields,
  questionnaireId,
  quoteId,
  initialValues = {},
  onSubmitted,
  apiBase = process.env.NEXT_PUBLIC_API_URL || "",
  completed = false,
}) => {
  const form = useForm<{ [k: string]: any }>({
    defaultValues: fields.reduce((acc, f) => {
      acc[f.key] = initialValues[f.key] ?? (f.type === "boolean" ? false : f.type === "number" ? undefined : "");
      return acc;
    }, {} as Record<string, any>),
  });

  async function onSubmit(values: Record<string, any>) {
    // Transform values to answers list using fieldId or key mapping
    const answers = fields.map((f) => ({
      fieldId: f.id, // backend expects fieldId when posting to quote-specific route
      key: f.key,
      value: normalizeValue(values[f.key], f.type),
    }));

    // Determine endpoint: quote-specific if quoteId provided, else generic future endpoint (placeholder)
    let url: string;
    if (quoteId) {
      url = apiBase.replace(/\/$/, "") + "/questionnaire-responses/quote/" + quoteId;
    } else {
      // Placeholder endpoint for generic responses (not in backend yet)
      url = apiBase.replace(/\/$/, "") + "/questionnaire-responses";
    }
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answers.map((a) => ({ fieldId: a.fieldId, value: a.value })), completed }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Failed to save responses");
      onSubmitted?.(json);
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
              {f.label}
              {f.required ? <span className="text-red-500">*</span> : null}
            </label>
            {renderFieldInput(form, f)}
            {form.formState.errors[f.key] && (
              <span className="text-[11px] text-red-600">{String(form.formState.errors[f.key]?.message || "Invalid value")}</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Saving…" : "Save Questionnaire"}
        </button>
      </div>
    </form>
  );
};

function renderFieldInput(form: ReturnType<typeof useForm>, f: QuestionnaireField) {
  const commonRegister = form.register(f.key, { required: f.required ? "Required" : false });
  switch (f.type) {
    case "text":
      return <Input {...commonRegister} />;
    case "number":
      return <Input type="number" {...commonRegister} onChange={(e) => form.setValue(f.key, e.target.value === "" ? undefined : Number(e.target.value))} />;
    case "boolean":
      return (
        <BooleanSwitch
          value={!!form.watch(f.key)}
          onChange={(v) => form.setValue(f.key, v, { shouldDirty: true })}
        />
      );
    case "select":
      return (
        <Select
          onValueChange={(v) => form.setValue(f.key, v, { shouldDirty: true })}
          value={form.watch(f.key) || ""}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(f.options || []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default:
      return <Input {...commonRegister} />;
  }
}

function normalizeValue(v: any, type: string) {
  if (v == null) return null;
  switch (type) {
    case "number":
      return typeof v === "number" ? v : Number(v);
    case "boolean":
      return !!v;
    default:
      return v;
  }
}

export default DynamicQuestionnaireForm;
