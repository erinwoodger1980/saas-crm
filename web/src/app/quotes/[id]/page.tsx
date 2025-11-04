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
  const [isRendering, setIsRendering] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [questionnaireSaving, setQuestionnaireSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rawParseOpen, setRawParseOpen] = useState(false);
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
      onParse={handleParse}
      onSaveMappings={handleSaveMappings}
      onRenderProposal={handleRenderProposal}
      onGenerateEstimate={handleEstimate}
      onDownloadCsv={handleDownloadCsv}
      disabled={quoteLoading || linesLoading}
      isUploading={isUploading}
      isParsing={isParsing}
      isSavingMappings={isSavingMappings}
      isRendering={isRendering}
      isEstimating={isEstimating}
      lastParsedAt={parseMeta?.finishedAt ?? parseMeta?.startedAt ?? null}
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
