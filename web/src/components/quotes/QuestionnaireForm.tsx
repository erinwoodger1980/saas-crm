import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Wand2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  // Filter to only public questionnaire fields
  const publicFields = useMemo(
    () => fields.filter((f) => f.askInQuestionnaire !== false && !f.internalOnly),
    [fields]
  );

  // Multi-item state
  const existingItems = useMemo(() => {
    const items = Array.isArray(answers?.items) ? answers.items : [];
    return items.length > 0 ? items : [{}];
  }, [answers]);

  const [itemAnswers, setItemAnswers] = useState<Record<string, any>[]>(existingItems);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItemAnswers(existingItems);
  }, [existingItems]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function flush() {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    setSaving(true);
    setError(null);
    try {
      // Save all items as custom.items
      await onAutoSave({ items: itemAnswers });
    } catch (err: any) {
      setError(err?.message || "Failed to save questionnaire");
    } finally {
      setSaving(false);
    }
  }

  function handleItemChange(itemIdx: number, key: string, value: any) {
    setItemAnswers((prev) => {
      const next = [...prev];
      next[itemIdx] = { ...next[itemIdx], [key]: value };
      return next;
    });
    pendingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, AUTOSAVE_DELAY);
  }

  function addItem() {
    setItemAnswers((prev) => {
      const last = prev[prev.length - 1] ?? {};
      // Copy last item but exclude size/dimensions fields
      const entries = Object.entries(last).filter(
        ([k]) => !k.toLowerCase().includes("size") && !k.toLowerCase().includes("dimension")
      );
      const base = Object.fromEntries(entries);
      return [...prev, base];
    });
    pendingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, AUTOSAVE_DELAY);
  }

  function removeItem(itemIdx: number) {
    if (itemAnswers.length === 1) return; // Keep at least one item
    setItemAnswers((prev) => prev.filter((_, i) => i !== itemIdx));
    pendingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, AUTOSAVE_DELAY);
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="text-xl font-semibold tracking-tight">Questionnaire</CardTitle>
          <p className="text-sm text-muted-foreground">
            {itemAnswers.length} item{itemAnswers.length !== 1 ? "s" : ""}. Changes auto-save.
          </p>
        </div>
        <div className="flex flex-col items-end text-xs text-muted-foreground">
          {(saving || isSaving) && (
            <span className="flex items-center gap-1 text-emerald-600">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

        {publicFields.length === 0 && (
          <div className="rounded-xl border border-dashed border-muted bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No public questionnaire fields configured. Configure fields in Settings → Questionnaire.
          </div>
        )}

        {publicFields.length > 0 && (
          <div className="space-y-4">
            {itemAnswers.map((item, itemIdx) => (
              <div key={itemIdx} className="rounded-2xl border border-slate-200 bg-card/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Item {itemIdx + 1}
                  </h3>
                  {itemAnswers.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(itemIdx)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {publicFields.map((field) => {
                    const value = item[field.key] ?? "";
                    return (
                      <div key={field.key} className="min-w-0 space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          {field.label}
                        </label>
                        {field.type === "textarea" ? (
                          <Textarea
                            value={value}
                            placeholder={field.description ?? field.label}
                            onChange={(e) => handleItemChange(itemIdx, field.key, e.target.value)}
                            disabled={disabled}
                            rows={2}
                            className="w-full text-sm"
                          />
                        ) : field.type === "select" && field.options ? (
                          <Select
                            value={value}
                            onValueChange={(v) => handleItemChange(itemIdx, field.key, v)}
                            disabled={disabled}
                          >
                            <SelectTrigger className="w-full truncate text-sm">
                              <SelectValue placeholder={`Select ${field.label}`} className="truncate" />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={field.type === "number" ? "number" : "text"}
                            value={value}
                            placeholder={field.description ?? field.label}
                            onChange={(e) => handleItemChange(itemIdx, field.key, e.target.value)}
                            disabled={disabled}
                            className="w-full text-sm"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              disabled={disabled}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add another item
            </Button>
          </div>
        )}

        {publicFields.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-muted p-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              <span>Generate an ML estimate from questionnaire answers.</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                // Ensure any pending auto-saves are flushed before triggering estimate
                await flush();
                onEstimateFromAnswers?.();
              }}
              disabled={!estimateSupported || disabled || !onEstimateFromAnswers}
              title={!estimateSupported && estimateDisabledReason ? estimateDisabledReason : undefined}
              className="self-start"
            >
              Generate ML estimate
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
