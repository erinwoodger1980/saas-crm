import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Wand2, FileText, Download, Image as ImageIcon, AlertTriangle, Edit3, ChevronDown, Box, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ParsedLineDto, QuestionnaireField, ParseResponse } from "@/lib/api/quotes";
import { ProductConfigurator3D } from "@/components/configurator/ProductConfigurator3D";
import { normalizeSceneConfig } from "@/lib/scene/config-validation";
import { canConfigure } from "@/lib/scene/builder-registry";
import { toast } from "sonner";
import type { SceneConfig } from "@/types/scene-config";
import { aiSuggestionToSceneConfig } from "@/lib/ai/aiSuggestionToSceneConfig";

export type ParsedLinesTableProps = {
  lines?: ParsedLineDto[] | null;
  questionnaireFields: QuestionnaireField[];
  mapping: Record<string, string | null | undefined>;
  onMappingChange: (_lineId: string, _questionKey: string | null) => void;
  onLineChange: (_lineId: string, _payload: { qty?: number | null; unitPrice?: number | null; lineStandard?: Record<string, any> }) => Promise<void>;
  currency?: string | null;
  isParsing?: boolean;
  parseMeta?: ParseResponse | null;
  onAutoMap: () => void;
  onShowRawParse: () => void;
  onDownloadCsv: () => void;
  imageUrlMap?: Record<string, string>;
  tenantId?: string;
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
  tenantId,
}: ParsedLinesTableProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingLine, setEditingLine] = useState<ParsedLineDto | null>(null);
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineDrafts, setInlineDrafts] = useState<Record<string, Record<string, any>>>({});
  const [configuringLine, setConfiguringLine] = useState<ParsedLineDto | null>(null);
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
                  <th className="px-4 py-3 text-center font-medium">Details</th>
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
                    <>
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
                        {/* Standard fields snapshot */}
                        {(() => {
                          const ls: any = (line as any).lineStandard || null;
                          if (!ls || typeof ls !== 'object') return null;
                          const width = ls.widthMm != null ? Number(ls.widthMm) : null;
                          const height = ls.heightMm != null ? Number(ls.heightMm) : null;
                          const timber = ls.timber || null;
                          const finish = ls.finish || null;
                          const ironmongery = ls.ironmongery || null;
                          const glazing = ls.glazing || null;
                          const hasAny = width || height || timber || finish || ironmongery || glazing;
                          if (!hasAny) return null;
                          return (
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                              {(width || height) && (
                                <span className="rounded border px-1.5 py-0.5 bg-muted/40 text-foreground">
                                  {width ? width : '—'}×{height ? height : '—'} mm
                                </span>
                              )}
                              {timber && <span className="rounded border px-1.5 py-0.5 bg-muted/40">{String(timber)}</span>}
                              {finish && <span className="rounded border px-1.5 py-0.5 bg-muted/40">{String(finish)}</span>}
                              {ironmongery && <span className="rounded border px-1.5 py-0.5 bg-muted/40">{String(ironmongery)}</span>}
                              {glazing && <span className="rounded border px-1.5 py-0.5 bg-muted/40">{String(glazing)}</span>}
                            </div>
                          );
                        })()}
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
                      <td className="w-40 px-4 py-3 text-center align-top">
                        <div className="flex items-center justify-center gap-1.5">
                          {canConfigure(line) && (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => setConfiguringLine(line)}
                              className="h-8 gap-1.5"
                              title="3D Configurator"
                            >
                              <Box className="h-3.5 w-3.5" />
                              3D
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingLine(line)}
                            className="h-8 gap-1.5"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const existing = (line as any).lineStandard || {};
                              setInlineDrafts((prev) => ({ ...prev, [line.id]: {
                                widthMm: existing.widthMm ?? "",
                                heightMm: existing.heightMm ?? "",
                                timber: existing.timber ?? "",
                                finish: existing.finish ?? "",
                                ironmongery: existing.ironmongery ?? "",
                                glazing: existing.glazing ?? "",
                                description: existing.description ?? line.description ?? "",
                              }}));
                              setInlineEditingId((cur) => (cur === line.id ? null : line.id));
                            }}
                            className="h-8 gap-1.5"
                            title="Quick edit"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                            Quick
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {inlineEditingId === line.id && (
                      <tr className="bg-muted/20">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[11px]">Description</Label>
                              <Input
                                value={inlineDrafts[line.id]?.description ?? ""}
                                onChange={(e) => setInlineDrafts((prev) => ({
                                  ...prev,
                                  [line.id]: { ...prev[line.id], description: e.target.value },
                                }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Width (mm)</Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={inlineDrafts[line.id]?.widthMm ?? ""}
                                onChange={(e) => setInlineDrafts((prev) => ({
                                  ...prev,
                                  [line.id]: { ...prev[line.id], widthMm: e.target.value },
                                }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Height (mm)</Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={inlineDrafts[line.id]?.heightMm ?? ""}
                                onChange={(e) => setInlineDrafts((prev) => ({
                                  ...prev,
                                  [line.id]: { ...prev[line.id], heightMm: e.target.value },
                                }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Timber</Label>
                              <Input
                                value={inlineDrafts[line.id]?.timber ?? ""}
                                onChange={(e) => setInlineDrafts((prev) => ({
                                  ...prev,
                                  [line.id]: { ...prev[line.id], timber: e.target.value },
                                }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Finish</Label>
                              <Input
                                value={inlineDrafts[line.id]?.finish ?? ""}
                                onChange={(e) => setInlineDrafts((prev) => ({
                                  ...prev,
                                  [line.id]: { ...prev[line.id], finish: e.target.value },
                                }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Ironmongery</Label>
                              <Input
                                value={inlineDrafts[line.id]?.ironmongery ?? ""}
                                onChange={(e) => setInlineDrafts((prev) => ({
                                  ...prev,
                                  [line.id]: { ...prev[line.id], ironmongery: e.target.value },
                                }))}
                              />
                            </div>
                            <div className="space-y-1 md:col-span-3">
                              <Label className="text-[11px]">Glazing</Label>
                              <Input
                                value={inlineDrafts[line.id]?.glazing ?? ""}
                                onChange={(e) => setInlineDrafts((prev) => ({
                                  ...prev,
                                  [line.id]: { ...prev[line.id], glazing: e.target.value },
                                }))}
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setInlineEditingId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={async () => {
                                const raw = inlineDrafts[line.id] || {};
                                const cleaned: Record<string, any> = {};
                                const keys = ['description','widthMm','heightMm','timber','finish','ironmongery','glazing'];
                                keys.forEach((k) => {
                                  const v = (raw as any)[k];
                                  if (v !== undefined && v !== null && String(v) !== '') {
                                    cleaned[k] = k === 'widthMm' || k === 'heightMm' ? Number(v) : v;
                                  }
                                });
                                await onLineChange(line.id, { lineStandard: cleaned });
                                setInlineEditingId(null);
                              }}
                            >
                              Save details
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  );
                })}
                {(lines ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
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

      <LineStandardDialog
        line={editingLine}
        onClose={() => setEditingLine(null)}
        onSave={async (lineStandard) => {
          if (!editingLine) return;
          await onLineChange(editingLine.id, { lineStandard });
          setEditingLine(null);
        }}
      />

      <ConfiguratorModal
        line={configuringLine}
        tenantId={tenantId}
        onClose={() => setConfiguringLine(null)}
      />
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

type LineStandardDialogProps = {
  line: ParsedLineDto | null;
  onClose: () => void;
  onSave: (lineStandard: Record<string, any>) => Promise<void>;
};

function LineStandardDialog({ line, onClose, onSave }: LineStandardDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (line) {
      const existing = (line as any).lineStandard || {};
      setFormData({
        widthMm: existing.widthMm || "",
        heightMm: existing.heightMm || "",
        timber: existing.timber || "",
        finish: existing.finish || "",
        ironmongery: existing.ironmongery || "",
        glazing: existing.glazing || "",
        description: existing.description || line.description || "",
        photoInsideFileId: existing.photoInsideFileId || "",
        photoOutsideFileId: existing.photoOutsideFileId || "",
      });
    }
  }, [line]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Clean up empty values
      const cleaned: Record<string, any> = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== "" && value != null) {
          cleaned[key] = value;
        }
      });
      await onSave(cleaned);
    } finally {
      setIsSaving(false);
    }
  };

  if (!line) return null;

  return (
    <Dialog open={!!line} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Line Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="widthMm">Width (mm)</Label>
              <Input
                id="widthMm"
                type="number"
                inputMode="decimal"
                placeholder="e.g. 826"
                value={formData.widthMm}
                onChange={(e) => setFormData({ ...formData, widthMm: e.target.value ? Number(e.target.value) : "" })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="heightMm">Height (mm)</Label>
              <Input
                id="heightMm"
                type="number"
                inputMode="decimal"
                placeholder="e.g. 2040"
                value={formData.heightMm}
                onChange={(e) => setFormData({ ...formData, heightMm: e.target.value ? Number(e.target.value) : "" })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timber">Timber</Label>
            <Select value={formData.timber} onValueChange={(value) => setFormData({ ...formData, timber: value })}>
              <SelectTrigger id="timber">
                <SelectValue placeholder="Select timber..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oak">Oak</SelectItem>
                <SelectItem value="sapele">Sapele</SelectItem>
                <SelectItem value="accoya">Accoya</SelectItem>
                <SelectItem value="iroko">Iroko</SelectItem>
                <SelectItem value="pine">Pine</SelectItem>
                <SelectItem value="hemlock">Hemlock</SelectItem>
                <SelectItem value="mdf">MDF</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="finish">Finish</Label>
            <Select value={formData.finish} onValueChange={(value) => setFormData({ ...formData, finish: value })}>
              <SelectTrigger id="finish">
                <SelectValue placeholder="Select finish..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primed">Primed</SelectItem>
                <SelectItem value="painted">Painted</SelectItem>
                <SelectItem value="stained">Stained</SelectItem>
                <SelectItem value="clear_lacquer">Clear Lacquer</SelectItem>
                <SelectItem value="wax">Wax</SelectItem>
                <SelectItem value="oiled">Oiled</SelectItem>
                <SelectItem value="unfinished">Unfinished</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ironmongery">Ironmongery</Label>
            <Select value={formData.ironmongery} onValueChange={(value) => setFormData({ ...formData, ironmongery: value })}>
              <SelectTrigger id="ironmongery">
                <SelectValue placeholder="Select ironmongery..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="hinges">Hinges</SelectItem>
                <SelectItem value="handles">Handles</SelectItem>
                <SelectItem value="locks">Locks</SelectItem>
                <SelectItem value="full_set">Full Set</SelectItem>
                <SelectItem value="fire_rated">Fire Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="glazing">Glazing</Label>
            <Select value={formData.glazing} onValueChange={(value) => setFormData({ ...formData, glazing: value })}>
              <SelectTrigger id="glazing">
                <SelectValue placeholder="Select glazing..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="clear">Clear Glass</SelectItem>
                <SelectItem value="obscure">Obscure Glass</SelectItem>
                <SelectItem value="double_glazed">Double Glazed</SelectItem>
                <SelectItem value="fire_rated">Fire Rated Glass</SelectItem>
                <SelectItem value="georgian">Georgian</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Additional details..."
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="photoInsideFileId">Photo (Inside) File ID</Label>
              <Input
                id="photoInsideFileId"
                placeholder="File ID..."
                value={formData.photoInsideFileId}
                onChange={(e) => setFormData({ ...formData, photoInsideFileId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="photoOutsideFileId">Photo (Outside) File ID</Label>
              <Input
                id="photoOutsideFileId"
                placeholder="File ID..."
                value={formData.photoOutsideFileId}
                onChange={(e) => setFormData({ ...formData, photoOutsideFileId: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* 3D Configurator Modal */
function ConfiguratorModal({
  line,
  tenantId,
  onClose,
}: {
  line: ParsedLineDto | null;
  tenantId?: string;
  onClose: () => void;
}) {
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<SceneConfig | null>(null);

  if (!line || !tenantId) return null;

  // If the line has a saved sceneConfig (e.g., from Instant Quote), normalize it
  const initialConfig = generatedConfig || normalizeSceneConfig(line.meta?.sceneConfig);

  const handleGenerateFromAI = async () => {
    if (!aiDescription.trim()) {
      toast.error('Description required');
      return;
    }

    setIsGenerating(true);
    try {
      // Extract product type from line item
      const productType = line.configuredProduct?.productType || {
        category: 'doors',
        type: 'entrance',
        option: 'E01',
      };

      // Get dimensions from line standard
      const widthMm = Number((line as any)?.lineStandard?.widthMm) || 914;
      const heightMm = Number((line as any)?.lineStandard?.heightMm) || 2032;
      const thicknessMm = Number((line as any)?.lineStandard?.thicknessMm) || 45;

      console.log('[Line Item AI] Calling estimate-components with:', {
        description: aiDescription,
        productType,
        dimensions: { widthMm, heightMm, thicknessMm },
      });

      const result = await fetch('/api/ai/estimate-components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'current',
          description: aiDescription,
          productType,
          existingDimensions: { widthMm, heightMm, thicknessMm },
        }),
      });

      if (!result.ok) {
        throw new Error(`AI estimation failed: ${result.statusText}`);
      }

      const aiData = await result.json();
      console.log('[Line Item AI] Response:', aiData);

      // Convert AI result to SceneConfig using shared helper
      const { getBuilder } = require('@/lib/scene/builder-registry');
      const builder = getBuilder(productType.category);
      const baseParams = builder.getDefaults(productType, {
        width: widthMm,
        height: heightMm,
        depth: thicknessMm,
      });

      const sceneConfig = aiSuggestionToSceneConfig({
        baseParams,
        ai: aiData,
        context: {
          tenantId: 'current',
          entityType: 'quoteLineItem',
          entityId: line.id,
        },
      });

      setGeneratedConfig(sceneConfig);
      setShowAIDialog(false);
      setAiDescription('');

      toast.success(`Created ${sceneConfig.components?.length || 0} components from AI`);
    } catch (error) {
      console.error('[Line Item AI] Error:', error);
      toast.error(error instanceof Error ? error.message : 'AI generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Dialog open={!!line} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>3D Product Configurator</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAIDialog(true)}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate from AI
              </Button>
            </DialogTitle>
          </DialogHeader>
          <ProductConfigurator3D
            tenantId={tenantId}
            entityType="quoteLineItem"
            entityId={line.id}
            lineItem={line}
            initialConfig={initialConfig || undefined}
            onClose={onClose}
            height="75vh"
            heroMode={true}
          />
        </DialogContent>
      </Dialog>

      {/* AI Description Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Product from Description</DialogTitle>
            <DialogDescription>
              Describe the product and we'll generate it using parametric builders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ai-desc">Description</Label>
              <Textarea
                id="ai-desc"
                placeholder="e.g., 4 panel door, oak timber, stile 120mm, glazed top panel"
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Examples: "2 panels" • "4 panels" • "glazed top" • "stile 120mm" • "ogee profile"
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIDialog(false)} disabled={isGenerating}>
              Cancel
            </Button>
            <Button onClick={handleGenerateFromAI} disabled={!aiDescription.trim() || isGenerating}>
              {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
