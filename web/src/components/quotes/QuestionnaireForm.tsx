import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { QuestionnaireField } from "@/lib/api/quotes";

export type QuestionnaireFormProps = {
  fields: QuestionnaireField[];
  answers: Record<string, any>;
  isSaving?: boolean;
  disabled?: boolean;
  onAutoSave: (changes: Record<string, any>) => Promise<void>;
  onEstimateFromAnswers?: () => void;
  estimateSupported?: boolean;
  estimateDisabledReason?: string;
};

const AUTOSAVE_DELAY = 500;

export function QuestionnaireForm({
  fields,
  answers,
  isSaving,
  disabled,
  onAutoSave,
  onEstimateFromAnswers,
  estimateSupported,
  estimateDisabledReason,
}: QuestionnaireFormProps) {
  const normalizedAnswers = useMemo(() => normalizeAnswers(answers), [answers]);
  const [drafts, setDrafts] = useState<Record<string, string>>(normalizedAnswers);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(normalizedAnswers);
  }, [normalizedAnswers]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const groups = useMemo(() => groupFields(fields), [fields]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({}));

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      groups.forEach(([name]) => {
        const key = name ?? "__default";
        if (next[key] === undefined) next[key] = true;
      });
      return next;
    });
  }, [groups]);

  async function flush() {
    if (!Object.keys(pendingRef.current).length) return;
    const payload = { ...pendingRef.current };
    pendingRef.current = {};
    setSaving(true);
    setError(null);
    try {
      await onAutoSave(payload);
    } catch (err: any) {
      setError(err?.message || "Failed to save questionnaire");
    } finally {
      setSaving(false);
    }
  }

  function handleChange(key: string, value: string) {
    setDrafts((prev) => ({ ...prev, [key]: value }));
    pendingRef.current = { ...pendingRef.current, [key]: value };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, AUTOSAVE_DELAY);
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="text-xl font-semibold tracking-tight">Questionnaire</CardTitle>
          <p className="text-sm text-muted-foreground">Keep customer context in sync. Changes auto-save.</p>
        </div>
        <div className="flex flex-col items-end text-xs text-muted-foreground">
          <span>{fields.length} fields</span>
          {(saving || isSaving) && (
            <span className="flex items-center gap-1 text-emerald-600">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
        <div className="space-y-3">
          {groups.map(([name, groupFields]) => {
            const groupKey = name ?? "__default";
            const open = openGroups[groupKey] ?? true;
            return (
              <div key={groupKey} className="rounded-2xl border bg-card/40">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [groupKey]: !open }))}
                >
                  <span className="text-sm font-semibold text-foreground">
                    {name ?? "General"}
                  </span>
                  <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
                </button>
                {open && (
                  <div className="space-y-3 border-t px-4 py-3">
                    {groupFields.map((field) => (
                      <label key={field.key} className="block text-sm">
                        <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
                        <Input
                          value={drafts[field.key] ?? ""}
                        placeholder={field.description ?? field.label}
                        onChange={(event) => handleChange(field.key, event.target.value)}
                        disabled={disabled}
                        className="mt-1"
                      />
                    </label>
                  ))}
                    {groupFields.length === 0 && (
                    <p className="text-xs text-muted-foreground">No questions configured for this section.</p>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-muted p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            <span>Use questionnaire answers to seed an estimate.</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onEstimateFromAnswers}
            disabled={!estimateSupported || disabled || !onEstimateFromAnswers}
            title={!estimateSupported && estimateDisabledReason ? estimateDisabledReason : undefined}
            className="self-start"
          >
            Use answers to estimate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type FieldGroupTuple = [string | null, QuestionnaireField[]];

function groupFields(fields: QuestionnaireField[]): FieldGroupTuple[] {
  const byGroup = new Map<string | null, QuestionnaireField[]>();
  fields.forEach((field) => {
    const key = field.group ?? null;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(field);
  });
  return Array.from(byGroup.entries());
}

function normalizeAnswers(answers: Record<string, any>) {
  const normalized: Record<string, string> = {};
  Object.entries(answers || {}).forEach(([key, value]) => {
    if (value == null) return;
    normalized[key] = typeof value === "string" ? value : String(value);
  });
  return normalized;
}
