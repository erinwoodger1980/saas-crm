import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Wand2, FileText, Download, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ParsedLineDto, QuestionnaireField, ParseResponse } from "@/lib/api/quotes";

export type ParsedLinesTableProps = {
  lines?: ParsedLineDto[] | null;
  questionnaireFields: QuestionnaireField[];
  mapping: Record<string, string | null | undefined>;
  onMappingChange: (lineId: string, questionKey: string | null) => void;
  onLineChange: (lineId: string, payload: { qty?: number | null; unitPrice?: number | null }) => Promise<void>;
  currency?: string | null;
  isParsing?: boolean;
  parseMeta?: ParseResponse | null;
  onAutoMap: () => void;
  onShowRawParse: () => void;
  onDownloadCsv: () => void;
};

const SAVE_DEBOUNCE_MS = 500;

export function ParsedLinesTable({
  lines,
  questionnaireFields,
  mapping,
  onMappingChange,
  onLineChange,
  currency,
  isParsing,
  parseMeta,
  onAutoMap,
  onShowRawParse,
  onDownloadCsv,
}: ParsedLinesTableProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      timerMap.forEach((timeoutId) => clearTimeout(timeoutId));
      timerMap.clear();
    };
  }, []);

  const totals = useMemo(() => computeTotals(lines), [lines]);

  function updateDraft(
    line: ParsedLineDto,
    next: Partial<DraftValues>,
    options: { schedule?: boolean } = {},
  ) {
    const base = drafts[line.id] ?? {
      qty: normalizeNumber(line.qty),
      unitPrice: normalizeNumber(line.unitPrice),
    };
    const resolved: DraftValues = {
      qty: next.qty !== undefined ? normalizeNumber(next.qty) : base.qty,
      unitPrice: next.unitPrice !== undefined ? normalizeNumber(next.unitPrice) : base.unitPrice,
    };
    setDrafts((prev) => ({ ...prev, [line.id]: resolved }));
    if (options.schedule) {
      const timerMap = timers.current;
      if (timerMap.has(line.id)) clearTimeout(timerMap.get(line.id)!);
      const timeoutId = setTimeout(() => flushSave(line.id), SAVE_DEBOUNCE_MS);
      timerMap.set(line.id, timeoutId);
    }
  }

  async function flushSave(lineId: string) {
    const timerMap = timers.current;
    if (timerMap.has(lineId)) {
      const timeoutId = timerMap.get(lineId);
      if (timeoutId) clearTimeout(timeoutId);
      timerMap.delete(lineId);
    }
    const draft = drafts[lineId];
    if (!draft) return;
    setSaving((prev) => ({ ...prev, [lineId]: true }));
    try {
      await onLineChange(lineId, { qty: draft.qty, unitPrice: draft.unitPrice });
    } catch (err) {
      console.warn("Failed to persist line", err);
    } finally {
      setSaving((prev) => ({ ...prev, [lineId]: false }));
    }
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-xl font-semibold tracking-tight">Parsed supplier lines</CardTitle>
          <p className="text-sm text-muted-foreground">Validate ML extraction, edit quantities, and map to questionnaire fields.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {isParsing && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Parsing…
            </Badge>
          )}
          {parseMeta?.usedStages && parseMeta.usedStages.length > 0 && (
            <span className="hidden sm:inline">Stages: {parseMeta.usedStages.join(" · ")}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onAutoMap} className="gap-2">
            <Sparkles className="h-4 w-4" /> Auto-map
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onShowRawParse} className="gap-2">
            <FileText className="h-4 w-4" /> Show raw parse
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDownloadCsv} className="gap-2">
            <Download className="h-4 w-4" /> Download CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {parseMeta?.warnings && parseMeta.warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-700">
              <Wand2 className="h-4 w-4" /> Parser warnings
            </div>
            <ul className="mt-2 space-y-1">
              {parseMeta.warnings.map((warning, index) => (
                <li key={index} className="text-xs text-amber-700">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border">
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Cost / unit</th>
                  <th className="px-4 py-3 text-left font-medium">Map to question</th>
                  <th className="px-4 py-3 text-right font-medium">Sell / unit</th>
                  <th className="px-4 py-3 text-right font-medium">Sell total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(lines ?? []).map((line) => {
                  const draft = drafts[line.id];
                  const qty = draft?.qty ?? normalizeNumber(line.qty);
                  const unitPrice = draft?.unitPrice ?? normalizeNumber(line.unitPrice);
                  const mappingValue = mapping[line.id] ?? null;
                  const valueForSelect = mappingValue ?? "__none__";
                  const sellUnit = normalizeNumber(line.meta?.sellUnitGBP ?? line.meta?.sell_unit ?? line.sellUnit);
                  const sellTotal = normalizeNumber(line.meta?.sellTotalGBP ?? line.meta?.sell_total ?? line.sellTotal);
                  const hasError = qty != null && qty < 0 || unitPrice != null && unitPrice < 0;

                  return (
                    <tr key={line.id} className={hasError ? "bg-rose-50/60" : undefined}>
                      <td className="max-w-md px-4 py-3 align-top">
                        <div className="line-clamp-2 font-medium" title={line.description ?? undefined}>
                          {line.description ?? "—"}
                        </div>
                        {line.meta?.supplier && (
                          <div className="mt-1 text-xs text-muted-foreground">{line.meta.supplier}</div>
                        )}
                      </td>
                      <td className="w-32 px-4 py-3 text-right align-top">
                        <Input
                          inputMode="decimal"
                          type="number"
                          value={qty ?? ""}
                          onChange={(event) => {
                            const nextValue = event.target.value === "" ? null : Number(event.target.value);
                            updateDraft(line, { qty: nextValue }, { schedule: true });
                          }}
                          onBlur={() => flushSave(line.id)}
                          onFocus={() => updateDraft(line, { qty })}
                          className="h-9 text-right"
                          min={0}
                        />
                        {saving[line.id] && <SavingHint />}
                      </td>
                      <td className="w-40 px-4 py-3 text-right align-top">
                        <Input
                          inputMode="decimal"
                          type="number"
                          value={unitPrice ?? ""}
                          onChange={(event) => {
                            const nextValue = event.target.value === "" ? null : Number(event.target.value);
                            updateDraft(line, { unitPrice: nextValue }, { schedule: true });
                          }}
                          onBlur={() => flushSave(line.id)}
                          onFocus={() => updateDraft(line, { unitPrice })}
                          className="h-9 text-right"
                        />
                      </td>
                      <td className="min-w-[14rem] px-4 py-3 align-top">
                        <Select
                          value={String(valueForSelect)}
                          onValueChange={(value) => onMappingChange(line.id, value === "__none__" ? null : value)}
                        >
                          <SelectTrigger className="h-9 w-full text-left">
                            <SelectValue placeholder="Select question" />
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            <SelectItem value="__none__">— Not mapped —</SelectItem>
                            {questionnaireFields.map((field) => (
                              <SelectItem key={field.key} value={field.key}>
                                <span className="font-medium">{field.label}</span>
                                <span className="ml-1 text-muted-foreground">({field.key})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="w-40 px-4 py-3 text-right align-top">
                        {sellUnit != null ? formatCurrency(sellUnit, currency) : "—"}
                      </td>
                      <td className="w-40 px-4 py-3 text-right align-top font-medium">
                        {sellTotal != null ? formatCurrency(sellTotal, currency) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {(lines ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Upload supplier PDFs then parse to see ML extracted lines.
                    </td>
                  </tr>
                )}
              </tbody>
              {(lines ?? []).length > 0 && (
                <tfoot>
                  <tr className="bg-muted/40 text-sm font-medium">
                    <td className="px-4 py-3 text-right" colSpan={4}>
                      Totals
                    </td>
                    <td className="px-4 py-3 text-right">{totals.sellUnit != null ? formatCurrency(totals.sellUnit, currency) : "—"}</td>
                    <td className="px-4 py-3 text-right">{totals.sellTotal != null ? formatCurrency(totals.sellTotal, currency) : "—"}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type DraftValues = {
  qty: number | null;
  unitPrice: number | null;
};

function computeTotals(lines?: ParsedLineDto[] | null) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { sellUnit: null, sellTotal: null };
  }
  let sellUnit = 0;
  let sellTotal = 0;
  let count = 0;
  for (const line of lines) {
    const unit = normalizeNumber(line.meta?.sellUnitGBP ?? line.meta?.sell_unit ?? line.sellUnit);
    const total = normalizeNumber(line.meta?.sellTotalGBP ?? line.meta?.sell_total ?? line.sellTotal);
    if (unit != null) {
      sellUnit += unit;
      count += 1;
    }
    if (total != null) sellTotal += total;
  }
  return {
    sellUnit: count > 0 ? sellUnit / count : null,
    sellTotal: sellTotal > 0 ? sellTotal : null,
  };
}

function normalizeNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCurrency(value: number, currency?: string | null) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP" }).format(value);
  } catch {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
  }
}

function SavingHint() {
  return (
    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" /> Saving…
    </div>
  );
}
