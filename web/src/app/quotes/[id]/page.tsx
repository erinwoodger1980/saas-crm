"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { QuoteBuilder } from "@/components/quotes/QuoteBuilder";
import { ActionsBar } from "@/components/quotes/ActionsBar";
import { ParsedLinesTable } from "@/components/quotes/ParsedLinesTable";
import { QuestionnaireForm } from "@/components/quotes/QuestionnaireForm";
import { SupplierFilesCard } from "@/components/quotes/SupplierFilesCard";
import { EstimatePanel } from "@/components/quotes/EstimatePanel";
import {
  fetchQuote,
  fetchParsedLines,
  parseSupplierPdfs,
  generateMlEstimate,
  uploadSupplierPdf,
  saveQuoteMappings,
  updateQuoteLine,
  normalizeQuestionnaireFields,
  processQuoteFromFile,
  saveClientQuoteLines,
  type SupplierFileDto as SupplierFile,
  type ProcessQuoteResponse,
} from "@/lib/api/quotes";
import type {
  EstimateResponse,
  ParsedLineDto,
  ParseResponse,
  QuestionnaireField,
  QuoteDto,
  SupplierFileDto,
} from "@/lib/api/quotes";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function QuoteBuilderPage() {
  const params = useParams();
  const quoteId = String(params?.id ?? "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const {
    data: quote,
    error: quoteError,
    isLoading: quoteLoading,
    mutate: mutateQuote,
  } = useSWR<QuoteDto>(quoteId ? ["quote", quoteId] : null, () => fetchQuote(quoteId), { revalidateOnFocus: false });

  const {
    data: lines,
    error: linesError,
    isLoading: linesLoading,
    mutate: mutateLines,
  } = useSWR<ParsedLineDto[]>(quoteId ? ["quote-lines", quoteId] : null, () => fetchParsedLines(quoteId), {
    revalidateOnFocus: false,
  });

  const {
    data: questionnaireFields = [],
  } = useSWR<QuestionnaireField[]>(quote ? ["tenant-questionnaire", quote.tenantId] : null, async () => {
    const settings = await apiFetch<any>("/tenant/settings");
    return normalizeQuestionnaireFields(settings?.questionnaire);
  });

  const leadId = quote?.leadId ?? null;
  const { data: lead } = useSWR<any>(leadId ? ["lead", leadId] : null, async () => {
    const res = await apiFetch<{ lead: any }>(`/leads/${leadId}`);
    return res?.lead ?? res ?? null;
  });

  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [parseMeta, setParseMeta] = useState<ParseResponse | null>(null);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [lastEstimateAt, setLastEstimateAt] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSavingMappings, setIsSavingMappings] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingSupplier, setIsProcessingSupplier] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [questionnaireSaving, setQuestionnaireSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rawParseOpen, setRawParseOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [markupPercent, setMarkupPercent] = useState<number>(20);
  const [vatPercent, setVatPercent] = useState<number>(20);
  const [markupDelivery, setMarkupDelivery] = useState<boolean>(false);
  const [amalgamateDelivery, setAmalgamateDelivery] = useState<boolean>(true);
  const [clientDeliveryCharge, setClientDeliveryCharge] = useState<number>(0);
  const [processedQuote, setProcessedQuote] = useState<ProcessQuoteResponse | null>(null);
  const [isSavingProcessed, setIsSavingProcessed] = useState(false);
  const [lineRevision, setLineRevision] = useState(0);
  const [estimatedLineRevision, setEstimatedLineRevision] = useState<number | null>(null);
  const lastLineSnapshotRef = useRef<string | null>(null);

  const questionnaireAnswers = useMemo(() => {
    if (!lead?.custom) return {};
    return { ...(lead.custom as Record<string, any>) };
  }, [lead]);

  const currency = quote?.currency ?? "GBP";
  const tenantName = quote?.tenant?.name ?? null;
  const quoteStatus = quote?.status ?? null;

  useEffect(() => {
    if (!lines) return;
    const next: Record<string, string | null> = {};
    lines.forEach((line) => {
      const key = extractQuestionKey(line);
      next[line.id] = key;
    });
    setMapping((prev) => (shallowEqual(prev, next) ? prev : next));

    const snapshot = JSON.stringify(
      lines.map((line) => ({
        id: line.id,
        qty: line.qty,
        unitPrice: line.unitPrice,
        sell: line.meta?.sellTotalGBP ?? line.meta?.sell_total ?? line.sellTotal,
      })),
    );
    if (lastLineSnapshotRef.current !== snapshot) {
      lastLineSnapshotRef.current = snapshot;
      setLineRevision((rev) => rev + 1);
    }
  }, [lines]);

  useEffect(() => {
    const lastParse = (quote?.meta as any)?.lastParse ?? null;
    if (lastParse) {
      setParseMeta(lastParse);
      if (lastParse?.message) {
        setNotice(lastParse.message);
      } else if (Array.isArray(lastParse?.warnings) && lastParse.warnings.length > 0) {
        setNotice(lastParse.warnings.join(" \u2022 "));
      } else {
        setNotice(null);
      }
    }
    const lastEstimate = (quote?.meta as any)?.lastEstimate ?? null;
    if (lastEstimate && !estimate) {
      setEstimate({
        estimatedTotal: lastEstimate.predictedTotal ?? lastEstimate.estimatedTotal ?? lastEstimate.totalGBP ?? null,
        predictedTotal: lastEstimate.predictedTotal ?? lastEstimate.estimatedTotal ?? null,
        totalGBP: lastEstimate.totalGBP ?? null,
        confidence: lastEstimate.confidence ?? null,
        currency: lastEstimate.currency ?? quote?.currency ?? null,
        modelVersionId: lastEstimate.modelVersionId ?? null,
        meta: { cacheHit: lastEstimate.cacheHit ?? false, latencyMs: lastEstimate.latencyMs ?? null },
      });
      setLastEstimateAt(lastEstimate.finishedAt ?? lastEstimate.createdAt ?? quote?.updatedAt ?? null);
      setEstimatedLineRevision((rev) => rev ?? lineRevision);
    }
  }, [quote, estimate, lineRevision]);

  useEffect(() => {
    setError(quoteError?.message || linesError?.message || null);
  }, [quoteError, linesError]);

  const reestimateNeeded = estimate && estimatedLineRevision !== null && estimatedLineRevision !== lineRevision;

  const handleParse = useCallback(async () => {
    if (!quoteId) return;
    setIsParsing(true);
    setError(null);
    try {
      const response = await parseSupplierPdfs(quoteId);
      setParseMeta(response);
      if (response?.async) {
        toast({ title: "Parsing supplier PDFs", description: "ML parser started. Refreshing shortly." });
      } else {
        toast({ title: "Parse complete", description: `Parsed ${response?.created ?? 0} line(s).` });
      }
      await Promise.all([mutateQuote(), mutateLines()]);
    } catch (err: any) {
      setError(err?.message || "Parse failed");
      toast({ title: "Parse failed", description: err?.message || "ML parser returned an error", variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  }, [quoteId, mutateQuote, mutateLines, toast]);

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!quoteId || !files || files.length === 0) return;
      setIsUploading(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          await uploadSupplierPdf(quoteId, file);
        }
        toast({ title: "Files uploaded", description: `${files.length} file(s) ready for parsing.` });
        await Promise.all([mutateQuote(), mutateLines()]);
      } catch (err: any) {
        setError(err?.message || "Upload failed");
        toast({ title: "Upload failed", description: err?.message || "Unable to upload supplier file", variant: "destructive" });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsUploading(false);
      }
    },
    [quoteId, mutateQuote, mutateLines, toast],
  );

  const handleSaveMappings = useCallback(async () => {
    if (!quoteId) return;
    setIsSavingMappings(true);
    setError(null);
    try {
      const payload = Object.entries(mapping).map(([lineId, questionKey]) => ({ lineId, questionKey: questionKey || null }));
      await saveQuoteMappings(quoteId, payload);
      toast({ title: "Mappings saved", description: "Line-to-questionnaire mappings updated." });
      await Promise.all([mutateQuote(), mutateLines()]);
    } catch (err: any) {
      setError(err?.message || "Failed to save mappings");
      toast({ title: "Save failed", description: err?.message || "Unable to save mappings", variant: "destructive" });
    } finally {
      setIsSavingMappings(false);
    }
  }, [quoteId, mapping, mutateQuote, mutateLines, toast]);

  const handleRenderProposal = useCallback(async () => {
    if (!quoteId) return;
    setIsRendering(true);
    setError(null);
    try {
      await apiFetch(`/quotes/${encodeURIComponent(quoteId)}/render-pdf`, { method: "POST" });
      const signed = await apiFetch<{ url: string }>(`/quotes/${encodeURIComponent(quoteId)}/proposal/signed`);
      if (signed?.url) window.open(signed.url, "_blank");
      toast({ title: "Proposal generated", description: "Proposal PDF opened in a new tab." });
    } catch (err: any) {
      setError(err?.message || "Failed to render proposal");
      toast({ title: "Proposal failed", description: err?.message || "Unable to render proposal", variant: "destructive" });
    } finally {
      setIsRendering(false);
    }
  }, [quoteId, toast]);

  const handleSaveEstimateToQuote = useCallback(async () => {
    toast({
      title: "Estimate saved",
      description: "Estimate totals are stored on the quote after ML pricing.",
    });
    await mutateQuote();
  }, [mutateQuote, toast]);

  const handleEstimate = useCallback(async () => {
    if (!quoteId) return;
    setIsEstimating(true);
    setError(null);
    try {
      const response = await generateMlEstimate(quoteId);
      setEstimate(response);
      setLastEstimateAt(new Date().toISOString());
      setEstimatedLineRevision(lineRevision);
      toast({ title: "Estimate ready", description: `Predicted total ${formatCurrency(response.estimatedTotal, currency)}.` });
      await Promise.all([mutateQuote(), mutateLines()]);
    } catch (err: any) {
      setError(err?.message || "Failed to estimate");
      toast({ title: "Estimate failed", description: err?.message || "Unable to generate ML estimate", variant: "destructive" });
    } finally {
      setIsEstimating(false);
    }
  }, [quoteId, lineRevision, mutateQuote, mutateLines, toast, currency]);

  const handleQuestionnaireEstimate = useCallback(async () => {
    if (!quoteId) return;
    setIsEstimating(true);
    try {
      const response = await generateMlEstimate(quoteId, { source: "questionnaire" });
      setEstimate(response);
      setLastEstimateAt(new Date().toISOString());
      toast({
        title: "Questionnaire estimate ready",
        description: `Predicted total ${formatCurrency(response.estimatedTotal, currency)}.`,
      });
      setEstimatedLineRevision(lineRevision);
      await Promise.all([mutateQuote(), mutateLines()]);
    } catch (err: any) {
      toast({
        title: "Estimate failed",
        description: err?.message || "Unable to estimate from questionnaire",
        variant: "destructive",
      });
    } finally {
      setIsEstimating(false);
    }
  }, [quoteId, mutateQuote, mutateLines, toast, currency, lineRevision]);

  const handleQuestionnaireSave = useCallback(
    async (changes: Record<string, any>) => {
      if (!leadId) return;
      setQuestionnaireSaving(true);
      try {
        await apiFetch(`/leads/${encodeURIComponent(leadId)}`, {
          method: "PATCH",
          json: { custom: changes },
        });
        toast({ title: "Questionnaire saved", description: "Customer responses updated." });
        await mutateQuote();
      } catch (err: any) {
        setError(err?.message || "Failed to save questionnaire");
        toast({ title: "Save failed", description: err?.message || "Unable to save questionnaire", variant: "destructive" });
        throw err;
      } finally {
        setQuestionnaireSaving(false);
      }
    },
    [leadId, mutateQuote, toast],
  );

  const handleLineChange = useCallback(
    async (lineId: string, payload: { qty?: number | null; unitPrice?: number | null }) => {
      if (!quoteId) return;
      try {
        await updateQuoteLine(quoteId, lineId, payload);
        await Promise.all([mutateQuote(), mutateLines()]);
        toast({ title: "Line updated", description: "Quote line saved." });
      } catch (err: any) {
        toast({ title: "Line update failed", description: err?.message || "Unable to save line", variant: "destructive" });
        throw err;
      }
    },
    [quoteId, mutateQuote, mutateLines, toast],
  );

  const handleDownloadCsv = useCallback(() => {
    if (!lines) return;
    const header = ["Description", "Qty", "Cost/unit", "Sell/unit", "Sell total", "Question key"];
    const rows = lines.map((line) => [
      sanitizeCsvValue(line.description),
      sanitizeCsvValue(line.qty),
      sanitizeCsvValue(line.unitPrice),
      sanitizeCsvValue(line.meta?.sellUnitGBP ?? line.meta?.sell_unit ?? line.sellUnit),
      sanitizeCsvValue(line.meta?.sellTotalGBP ?? line.meta?.sell_total ?? line.sellTotal),
      sanitizeCsvValue(mapping[line.id]),
    ]);
    const csv = [header, ...rows].map((row) => row.map(quoteCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quote-${quoteId}-lines.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [lines, mapping, quoteId]);

  const openUploadDialog = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.click();
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        void handleParse();
      } else if (event.key === "e" || event.key === "E") {
        event.preventDefault();
        void handleEstimate();
      } else if (event.key === "u" || event.key === "U") {
        event.preventDefault();
        openUploadDialog();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleEstimate, handleParse, openUploadDialog]);

  const handleOpenFile = useCallback(
    async (file: SupplierFileDto) => {
      if (!quoteId || !file?.id) return;
      try {
        const signed = await apiFetch<{ url: string }>(
          `/quotes/${encodeURIComponent(quoteId)}/files/${encodeURIComponent(file.id)}/signed`,
        );
        if (signed?.url) window.open(signed.url, "_blank");
      } catch (err: any) {
        toast({ title: "Unable to open file", description: err?.message || "Missing supplier file", variant: "destructive" });
      }
    },
    [quoteId, toast],
  );

  const breadcrumbs = (
    <>
      <Link href="/quotes" className="text-muted-foreground hover:text-foreground">
        Quotes
      </Link>
      <span className="text-muted-foreground/80">/</span>
      <span className="text-foreground">Quote builder</span>
    </>
  );

  const errorBanner = error ? (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
  ) : null;
  const noticeBanner = notice ? (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{notice}</div>
  ) : null;

  const rawSummaries = parseMeta?.summaries ?? [];

  const actionsBar = (
    <ActionsBar
      onUploadClick={openUploadDialog}
      onProcessSupplier={() => setProcessDialogOpen(true)}
      onRenderProposal={handleRenderProposal}
      onGenerateEstimate={handleEstimate}
      onDownloadCsv={handleDownloadCsv}
      disabled={quoteLoading || linesLoading}
      isUploading={isUploading}
      isProcessingSupplier={isProcessingSupplier}
      isRendering={isRendering}
      isEstimating={isEstimating}
      lastEstimateAt={lastEstimateAt}
      reestimate={Boolean(reestimateNeeded)}
      estimateCached={Boolean(estimate?.meta?.cacheHit)}
    />
  );

  const questionnaireSection = (
    <QuestionnaireForm
      fields={questionnaireFields}
      answers={questionnaireAnswers}
      isSaving={questionnaireSaving}
      disabled={quoteLoading || !leadId}
      onAutoSave={handleQuestionnaireSave}
      onEstimateFromAnswers={handleQuestionnaireEstimate}
      estimateSupported={Boolean(leadId)}
      estimateDisabledReason={leadId ? undefined : "Quote is not linked to a lead."}
    />
  );

  const estimateSection = (
    <EstimatePanel
      quote={quote}
      estimate={estimate}
      linesCount={lines?.length ?? 0}
      currency={currency}
      isEstimating={isEstimating}
      onEstimate={handleEstimate}
      onSaveEstimate={handleSaveEstimateToQuote}
      onApprove={handleRenderProposal}
      reestimate={Boolean(reestimateNeeded)}
      lastEstimateAt={lastEstimateAt}
      cacheHit={estimate?.meta?.cacheHit}
      latencyMs={estimate?.meta?.latencyMs ?? null}
    />
  );

  const linesSection = (
    <ParsedLinesTable
      lines={lines}
      questionnaireFields={questionnaireFields}
      mapping={mapping}
      onMappingChange={(lineId, questionKey) => setMapping((prev) => ({ ...prev, [lineId]: questionKey }))}
      onLineChange={handleLineChange}
      currency={currency}
      isParsing={isParsing}
      parseMeta={parseMeta}
      onAutoMap={() => {
        setMapping((prev) => autoMap(lines, questionnaireFields, prev));
        toast({ title: "Mapping suggested", description: "Mapped similar fields based on keywords." });
      }}
      onShowRawParse={() => setRawParseOpen(true)}
      onDownloadCsv={handleDownloadCsv}
    />
  );

  const filesSection = (
    <SupplierFilesCard
      files={quote?.supplierFiles}
      onOpen={handleOpenFile}
      onUpload={handleUploadFiles}
      onUploadClick={openUploadDialog}
      isUploading={isUploading}
    />
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(event) => handleUploadFiles(event.target.files)}
      />
      <QuoteBuilder
        header={{ title: "Quote builder", breadcrumbs, tenantName, status: quoteStatus, meta: quoteMeta(quote) }}
        actionsBar={actionsBar}
        notice={noticeBanner}
        error={errorBanner}
        isLoading={quoteLoading || linesLoading}
        leftColumn={<>{questionnaireSection}</>}
        rightColumn={
          <>
            {estimateSection}
            <ProcessedQuotePreview
              result={processedQuote}
              currency={currency}
              isSaving={isSavingProcessed}
              onSave={async () => {
                if (!quoteId || !processedQuote || processedQuote.quote_type !== "supplier") return;
                setIsSavingProcessed(true);
                try {
                  await saveClientQuoteLines(quoteId, processedQuote.client_quote, { replace: true });
                  await Promise.all([mutateQuote(), mutateLines()]);
                  toast({ title: "Saved", description: "Client quote lines have been saved to the quote." });
                } catch (err: any) {
                  toast({ title: "Save failed", description: err?.message || "Unable to save processed lines", variant: "destructive" });
                } finally {
                  setIsSavingProcessed(false);
                }
              }}
            />
            {linesSection}
            {filesSection}
          </>
        }
      />

      <Dialog open={rawParseOpen} onOpenChange={setRawParseOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Parse summaries</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-lg bg-muted/40 p-4 text-xs">
            {JSON.stringify(rawSummaries, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Convert supplier PDF → client quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Supplier file</label>
              <select
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={selectedFileId ?? ""}
                onChange={(e) => setSelectedFileId(e.target.value || null)}
              >
                <option value="">Select a file…</option>
                {(quote?.supplierFiles ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name || "Supplier PDF"}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium">Markup %</label>
                <input
                  type="number"
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={markupPercent}
                  onChange={(e) => setMarkupPercent(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">VAT %</label>
                <input
                  type="number"
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={vatPercent}
                  onChange={(e) => setVatPercent(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-end gap-2">
                <input
                  id="markupDelivery"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={markupDelivery}
                  onChange={(e) => setMarkupDelivery(e.target.checked)}
                />
                <label htmlFor="markupDelivery" className="text-sm">Markup delivery</label>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-end gap-2 col-span-2">
                <input
                  id="amalgamateDelivery"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={amalgamateDelivery}
                  onChange={(e) => setAmalgamateDelivery(e.target.checked)}
                />
                <label htmlFor="amalgamateDelivery" className="text-sm">Amalgamate supplier delivery across items</label>
              </div>
              <div>
                <label className="block text-sm font-medium">Client delivery charge</label>
                <input
                  type="number"
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={clientDeliveryCharge}
                  onChange={(e) => setClientDeliveryCharge(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                className="inline-flex items-center rounded-md border bg-background px-3 py-2 text-sm"
                onClick={() => setProcessDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center rounded-md bg-foreground px-3 py-2 text-sm text-background disabled:opacity-60"
                disabled={!selectedFileId || isProcessingSupplier}
                onClick={async () => {
                  if (!quoteId || !selectedFileId) return;
                  setIsProcessingSupplier(true);
                  try {
                    const file = (quote?.supplierFiles ?? []).find((f) => f.id === selectedFileId) as SupplierFile | undefined;
                    if (!file) throw new Error("Select a file to process");
                    const resp = await processQuoteFromFile(quoteId, file, {
                      markupPercent,
                      vatPercent,
                      markupDelivery,
                      amalgamateDelivery,
                      clientDeliveryGBP: clientDeliveryCharge > 0 ? clientDeliveryCharge : undefined,
                      clientDeliveryDescription: clientDeliveryCharge > 0 ? "Delivery" : undefined,
                    });
                    setProcessedQuote(resp);
                    setProcessDialogOpen(false);
                    if ((resp as any)?.quote_type === "supplier" && (resp as any)?.client_quote?.grand_total != null) {
                      const gt = (resp as any).client_quote.grand_total as number;
                      toast({
                        title: "Client quote ready",
                        description: `Grand total ${formatCurrency(gt, currency)} (preview below).`,
                      });
                    } else if ((resp as any)?.quote_type === "client") {
                      toast({ title: "Client quote detected", description: "Added as training candidate (preview below)." });
                    } else {
                      toast({ title: "Processing complete", description: "Could not classify confidently. See preview." });
                    }
                  } catch (err: any) {
                    toast({ title: "Conversion failed", description: err?.message || "ML service error", variant: "destructive" });
                  } finally {
                    setIsProcessingSupplier(false);
                  }
                }}
              >
                {isProcessingSupplier ? "Converting…" : "Convert"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function shallowEqual(a: Record<string, string | null>, b: Record<string, string | null>) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function extractQuestionKey(line: ParsedLineDto): string | null {
  const meta = line.meta ?? {};
  const key = meta?.questionKey ?? meta?.question_key ?? null;
  if (typeof key === "string" && key.trim()) return key.trim();
  return null;
}

function quoteMeta(quote?: QuoteDto | null) {
  if (!quote) return null;
  const updatedAt = quote.updatedAt ? new Date(quote.updatedAt).toLocaleString() : null;
  return updatedAt ? <span>Updated {updatedAt}</span> : null;
}

function autoMap(
  lines: ParsedLineDto[] | undefined | null,
  fields: QuestionnaireField[],
  current: Record<string, string | null>,
) {
  if (!lines || lines.length === 0 || fields.length === 0) return current;
  const next: Record<string, string | null> = { ...current };
  lines.forEach((line) => {
    const description = (line.description || "").toLowerCase();
    if (!description) return;
    const match = fields.find((field) => description.includes(field.label.toLowerCase()));
    if (match) next[line.id] = match.key;
  });
  return next;
}

function sanitizeCsvValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return String(value);
}

function quoteCsv(value: string) {
  const needsQuotes = value.includes(",") || value.includes("\"") || value.includes("\n");
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function formatCurrency(value?: number | null, currency?: string | null) {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP" }).format(value);
  } catch {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
  }
}

// Small inline preview renderer for processed quotes (supplier → client)
function ProcessedQuotePreview({ result, currency, onSave, isSaving }: { result: ProcessQuoteResponse | null; currency?: string | null; onSave?: () => void | Promise<void>; isSaving?: boolean }) {
  if (!result || !result.ok) return null as any;
  if (result.quote_type === "supplier") {
    const cq = result.client_quote;
    return (
      <div className="mt-6 rounded-2xl border bg-muted/30 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">Client quote preview</div>
          <div className="flex items-center gap-3">
            <div className="text-sm whitespace-nowrap">
              Subtotal {formatCurrency(cq.subtotal ?? null, currency)} · VAT {formatCurrency(cq.vat_amount ?? null, currency)} ·
              <span className="ml-1 font-medium">Total {formatCurrency(cq.grand_total ?? null, currency)}</span>
            </div>
            {onSave ? (
              <button
                className="inline-flex items-center rounded-md bg-foreground px-3 py-1.5 text-xs text-background disabled:opacity-60"
                onClick={() => void onSave()}
                disabled={Boolean(isSaving)}
                title="Replace existing quote lines with this client quote"
              >
                {isSaving ? "Saving…" : "Save as lines"}
              </button>
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-2 py-1">Description</th>
                <th className="px-2 py-1">Qty</th>
                <th className="px-2 py-1">Unit (marked)</th>
                <th className="px-2 py-1">Total (marked)</th>
              </tr>
            </thead>
            <tbody>
              {cq.lines.map((ln, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1">{ln.description}</td>
                  <td className="px-2 py-1">{ln.qty}</td>
                  <td className="px-2 py-1">{formatCurrency(ln.unit_price_marked_up, currency)}</td>
                  <td className="px-2 py-1">{formatCurrency(ln.total_marked_up, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (result.quote_type === "client") {
    return (
      <div className="mt-6 rounded-2xl border bg-muted/30 p-4 text-sm">
        Detected a client quote. Parsed fields are available for training. Confidence: {(result.training_candidate as any)?.confidence ?? 0}
      </div>
    );
  }
  return (
    <div className="mt-6 rounded-2xl border bg-muted/30 p-4 text-sm">
      Could not confidently classify this PDF. Try adjusting settings or parsing manually.
    </div>
  );
}
