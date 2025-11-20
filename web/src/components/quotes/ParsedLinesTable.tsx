import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Wand2, FileText, Download, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ParsedLineDto, QuestionnaireField, ParseResponse } from "@/lib/api/quotes";

export type ParsedLinesTableProps = {
  lines?: ParsedLineDto[] | null;
  questionnaireFields: QuestionnaireField[];
  mapping: Record<string, string | null | undefined>;
  onMappingChange: (_lineId: string, _questionKey: string | null) => void;
  onLineChange: (_lineId: string, _payload: { qty?: number | null; unitPrice?: number | null }) => Promise<void>;
  currency?: string | null;
  isParsing?: boolean;
  parseMeta?: ParseResponse | null;
  onAutoMap: () => void;
  onShowRawParse: () => void;
  onDownloadCsv: () => void;
  imageUrlMap?: Record<string, string>;
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
  imageUrlMap = {},
}: ParsedLinesTableProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      timerMap.forEach((timeoutId) => clearTimeout(timeoutId));
      timerMap.clear();
    };
  }, []);

  const parseSummaries = (parseMeta?.summaries ?? []) as Array<Record<string, any>>;
  const poorSummaries = parseSummaries.filter((summary) => summary && summary.quality === "poor");
  const showLowQualityNotice = parseMeta?.quality === "poor" || poorSummaries.length > 0;
  const fallbackStats = parseMeta?.fallbackScored || null;
  const keptRows = typeof fallbackStats?.kept === "number" ? fallbackStats.kept : null;
  const discardedRows = typeof fallbackStats?.discarded === "number" ? fallbackStats.discarded : null;
  const showDiscardedWarning =
    keptRows != null && discardedRows != null ? discardedRows > keptRows : discardedRows != null && discardedRows > 10;

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
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">Quote line items</CardTitle>
            <p className="text-sm text-muted-foreground">Review and edit line items from all sources (supplier PDFs, ML estimates, manual entry)</p>
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
          {showLowQualityNotice && (
            <Badge variant="destructive" className="hidden sm:inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Low quality
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

        {showLowQualityNotice && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
              <AlertTriangle className="h-4 w-4" /> Low confidence parse
            </div>
            <p className="mt-2 text-xs text-rose-800">
              The fallback cleaner flagged these lines as unreliable. Double-check descriptions, line totals, and mappings before sending a quote.
            </p>
            {poorSummaries.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-rose-800">
                {poorSummaries.slice(0, 3).map((summary, index) => {
                  const cleaner = (summary?.cleaner ?? {}) as Record<string, any>;
                  const rawRows = typeof cleaner?.rawRows === "number" ? cleaner.rawRows : null;
                  const discardedRows = typeof cleaner?.discardedRows === "number" ? cleaner.discardedRows : null;
                  const label = summary?.name || summary?.fileId || summary?.id || `File #${index + 1}`;
                  return (
                    <li key={`${label}-${index}`} className="flex items-center justify-between gap-2">
                      <span className="font-medium text-rose-900">{label}</span>
                      <span className="text-[11px] text-rose-700">
                        {rawRows != null ? `${rawRows} rows` : "Unknown rows"}
                        {discardedRows != null ? ` · ${discardedRows} trimmed` : null}
                      </span>
                    </li>
                  );
                })}
                {poorSummaries.length > 3 && (
                  <li className="text-[11px] text-rose-700">+{poorSummaries.length - 3} more files with low confidence</li>
                )}
              </ul>
            )}
          </div>
        )}

        {showDiscardedWarning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
              <AlertTriangle className="h-4 w-4" /> Many rows were discarded
            </div>
            <p className="mt-2 text-xs text-amber-800">
              We discarded a lot of dubious rows from this PDF. Please review the remaining line items carefully and confirm they look correct before quoting.
            </p>
            <p className="mt-2 text-[11px] font-medium text-amber-700">
              {keptRows != null ? `${keptRows} kept` : "— kept"} · {discardedRows != null ? `${discardedRows} discarded` : "— discarded"}
            </p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border">
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-20 bg-muted/80 text-xs uppercase tracking-wide text-muted-foreground backdrop-blur shadow">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Image</th>
                  <th className="px-4 py-3 text-left font-medium sticky left-16 bg-muted/80 z-30">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Cost / unit</th>
                  <th className="px-4 py-3 text-right font-medium">Sell / unit</th>
                  <th className="px-4 py-3 text-right font-medium">Sell total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(lines ?? []).map((line) => {
                  const draft = drafts[line.id];
                  const qty = draft?.qty ?? normalizeNumber(line.qty);
                  const unitPrice = draft?.unitPrice ?? normalizeNumber(line.unitPrice);
                  const sellUnit = normalizeNumber(line.meta?.sellUnitGBP ?? line.meta?.sell_unit ?? line.sellUnit);
                  const sellTotal = normalizeNumber(line.meta?.sellTotalGBP ?? line.meta?.sell_total ?? line.sellTotal);
                  const hasError = (qty != null && qty < 0) || (unitPrice != null && unitPrice < 0);
                  const imageFileId = line.meta?.imageFileId;
                  const imageUrl = imageFileId ? imageUrlMap[imageFileId] : undefined;

                  return (
                    <tr
                      key={line.id}
                      className={`transition-colors ${hasError ? "bg-rose-50/80" : "hover:bg-slate-50/80"}`}
                    >
                      <td className="w-20 px-4 py-3 align-top">
                        {imageUrl ? (
                          <button
                            onClick={() => setSelectedImage(imageUrl)}
                            className="block w-12 h-12 rounded border overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                          >
                            <img 
                              src={imageUrl} 
                              alt="Line item"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ) : (
                          <div className="w-12 h-12 rounded border bg-muted/30 flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        )}
                      </td>
                      <td className="max-w-md px-4 py-3 align-top sticky left-16 bg-white z-10 shadow-sm">
                        <div className="line-clamp-2 font-medium" title={line.description ?? undefined}>
                          {line.description ?? "—"}
                        </div>
                        {line.meta?.supplier && (
                          <div className="mt-1 text-xs text-muted-foreground">{line.meta.supplier}</div>
                        )}
                      </td>
                      <td className="w-32 px-4 py-3 text-right align-top">
                        <div className="relative group">
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
                            aria-label="Quantity"
                          />
                          <span className="absolute left-1 top-1 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Qty</span>
                          {saving[line.id] && <SavingHint />}
                        </div>
                      </td>
                      <td className="w-40 px-4 py-3 text-right align-top">
                        <div className="relative group">
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
                            aria-label="Unit price"
                          />
                          <span className="absolute left-1 top-1 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Unit price</span>
                        </div>
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
                      No line items yet. Upload supplier PDFs or generate ML estimates to create lines.
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

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Line item image</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="flex items-center justify-center">
              <img 
                src={selectedImage} 
                alt="Line item full size"
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
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
