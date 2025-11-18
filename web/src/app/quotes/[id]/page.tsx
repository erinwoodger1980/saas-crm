"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ParsedLinesTable } from "@/components/quotes/ParsedLinesTable";
import { QuestionnaireForm } from "@/components/quotes/QuestionnaireForm";
import { SupplierFilesCard } from "@/components/quotes/SupplierFilesCard";
import { QuoteStepper } from "@/components/quotes/QuoteStepper";
import { QuoteEstimateSidebar } from "@/components/quotes/QuoteEstimateSidebar";
import { LeadDetailsCard } from "@/components/quotes/LeadDetailsCard";
import { ClientQuoteUploadCard } from "@/components/quotes/ClientQuoteUploadCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Printer } from "lucide-react";
import {
  fetchQuote,
  fetchParsedLines,
  parseSupplierPdfs,
  generateMlEstimate,
  uploadSupplierPdf,
  uploadClientQuotePdf,
  saveQuoteMappings,
  updateQuoteLine,
  normalizeQuestionnaireFields,
  processQuoteFromFile,
  saveClientQuoteLines,
  priceQuoteFromQuestionnaire,
  type SupplierFileDto as SupplierFile,
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
  const [_isSavingMappings, setIsSavingMappings] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingClientQuote, setIsUploadingClientQuote] = useState(false);
  const [isProcessingSupplier, setIsProcessingSupplier] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isPricing, setIsPricing] = useState(false);
  const [questionnaireSaving, setQuestionnaireSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rawParseOpen, setRawParseOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [pricingBreakdown, setPricingBreakdown] = useState<Record<string, any> | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [markupPercent, setMarkupPercent] = useState<number>(20);
  const [vatPercent, setVatPercent] = useState<number>(20);
  const [markupDelivery, setMarkupDelivery] = useState<boolean>(false);
  const [amalgamateDelivery, setAmalgamateDelivery] = useState<boolean>(true);
  const [clientDeliveryCharge, setClientDeliveryCharge] = useState<number>(0);
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

  const handleUploadClientQuoteFiles = useCallback(
    async (files: FileList | null) => {
      if (!quoteId || !files || files.length === 0) return;
      setIsUploadingClientQuote(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          await uploadClientQuotePdf(quoteId, file);
        }
        toast({ title: "Client quote uploaded", description: `${files.length} file(s) uploaded successfully.` });
        await mutateQuote();
      } catch (err: any) {
        setError(err?.message || "Upload failed");
        toast({ title: "Upload failed", description: err?.message || "Unable to upload client quote", variant: "destructive" });
      } finally {
        setIsUploadingClientQuote(false);
      }
    },
    [quoteId, mutateQuote, toast],
  );

  const _handleSaveMappings = useCallback(async () => {
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
    setIsPricing(true);
    try {
      // Call questionnaire pricing endpoint (server-calculated)
      const res = await priceQuoteFromQuestionnaire(quoteId);
      // Update lightweight estimate state from response
      const est = {
        estimatedTotal: res.total,
        predictedTotal: res.total,
        totalGBP: res.total,
        confidence: res.confidence ?? null,
        currency: quote?.currency ?? currency ?? "GBP",
        modelVersionId: null,
        meta: {},
      } as any;
      setEstimate(est);
      setLastEstimateAt(new Date().toISOString());
      setEstimatedLineRevision(lineRevision);
      setPricingBreakdown(res.breakdown ?? null);
      toast({
        title: "Questionnaire pricing complete",
        description: `Total ${formatCurrency(res.total, currency)}${res.confidence != null ? ` · conf ${Math.round(res.confidence * 100)}%` : ""}`,
      });

      // Refresh data before rendering proposal
      await Promise.all([mutateQuote(), mutateLines()]);

      // Auto-render proposal (optional convenience)
      setIsRendering(true);
      try {
        await new Promise((r) => setTimeout(r, 500));
        await apiFetch(`/quotes/${encodeURIComponent(quoteId)}/render-proposal`, { method: "POST" });
        const signed = await apiFetch<{ url: string }>(`/quotes/${encodeURIComponent(quoteId)}/proposal/signed`);
        if (signed?.url) window.open(signed.url, "_blank");
      } catch (renderErr: any) {
        toast({ title: "Estimate saved, but proposal render failed", description: renderErr?.message || "Try 'Render proposal'", variant: "destructive" });
      } finally {
        setIsRendering(false);
      }
    } catch (err: any) {
      toast({ title: "Pricing failed", description: err?.message || "Unable to price from questionnaire", variant: "destructive" });
    } finally {
      setIsEstimating(false);
      setIsPricing(false);
    }
  }, [quoteId, mutateQuote, mutateLines, toast, currency, lineRevision, quote?.currency]);

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
        void handleQuestionnaireEstimate();
      } else if (event.key === "u" || event.key === "U") {
        event.preventDefault();
        openUploadDialog();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleEstimate, handleParse, openUploadDialog, handleQuestionnaireEstimate]);

  const handleOpenFile = useCallback(
    async (file: SupplierFileDto) => {
      if (!quoteId || !file?.id) return;
      try {
        const signed = await apiFetch<{ url: string }>(
          `/quotes/${encodeURIComponent(quoteId)}/files/${encodeURIComponent(file.id)}/signed`,
        );
        if (signed?.url) window.open(signed.url, "_blank");
      } catch (err: any) {
        toast({ title: "Unable to open file", description: err?.message || "Missing file", variant: "destructive" });
      }
    },
    [quoteId, toast],
  );

  const handleOpenClientQuoteFile = useCallback(
    async (file: SupplierFileDto) => {
      if (!quoteId || !file?.id) return;
      try {
        const signed = await apiFetch<{ url: string }>(
          `/quotes/${encodeURIComponent(quoteId)}/files/${encodeURIComponent(file.id)}/signed`,
        );
        if (signed?.url) window.open(signed.url, "_blank");
      } catch (err: any) {
        toast({ title: "Unable to open file", description: err?.message || "Missing client quote file", variant: "destructive" });
      }
    },
    [quoteId, toast],
  );

  // Determine current step based on state
  const [currentTab, setCurrentTab] = useState("questionnaire");
  const currentStep = currentTab === "questionnaire" ? 0 : currentTab === "supplier" ? 1 : 2;

  const steps = [
    { id: "questionnaire", title: "Questionnaire", description: "Gather project details" },
    { id: "supplier", title: "Supplier quote", description: "Upload & parse PDFs" },
    { id: "pricing", title: "Pricing & proposal", description: "Review & finalize" },
  ];

  const breadcrumbs = (
    <>
      <Link href="/quotes" className="text-muted-foreground hover:text-foreground transition-colors">
        Quotes
      </Link>
      <span className="text-muted-foreground/60">/</span>
      <span className="font-medium text-foreground">{quote?.title ?? "Quote builder"}</span>
    </>
  );

  const errorBanner = error ? (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">{error}</div>
  ) : null;
  const noticeBanner = notice ? (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">{notice}</div>
  ) : null;

  const rawSummaries = parseMeta?.summaries ?? [];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-6 lg:py-8">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(event) => handleUploadFiles(event.target.files)}
      />
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">{breadcrumbs}</div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  {quote?.title ?? "Quote Builder"}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {tenantName && <span className="font-medium text-foreground">{tenantName}</span>}
                  {quote?.updatedAt && (
                    <span>Updated {new Date(quote.updatedAt).toLocaleString()}</span>
                  )}
                </div>
              </div>
              <Link href={`/quotes/${quoteId}/print`} target="_blank">
                <Button variant="outline" size="sm" className="gap-2">
                  <Printer className="h-4 w-4" />
                  Print Quote Sheet
                </Button>
              </Link>
              {pricingBreakdown && (
                <Button variant="secondary" size="sm" className="gap-2" onClick={() => setBreakdownOpen(true)}>
                  <Sparkles className="h-4 w-4" />
                  View pricing breakdown
                </Button>
              )}
            </div>
          </div>

          {/* Stepper */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <QuoteStepper
              steps={steps}
              currentStep={currentStep}
              onStepClick={(idx) => {
                const stepMap = ["questionnaire", "supplier", "lines"];
                setCurrentTab(stepMap[idx] ?? "questionnaire");
              }}
            />
          </div>

          {/* Notices */}
          {errorBanner}
          {noticeBanner}

          {quoteLoading || linesLoading ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
              <div className="space-y-4">
                <div className="h-24 rounded-2xl bg-muted/40 animate-pulse"></div>
                <div className="h-96 rounded-2xl bg-muted/40 animate-pulse"></div>
              </div>
              <div className="h-[600px] rounded-2xl bg-muted/40 animate-pulse"></div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
              {/* Left: Main working area with tabs */}
              <div className="space-y-4">
                <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="questionnaire">Questionnaire</TabsTrigger>
                    <TabsTrigger value="supplier">Supplier quote</TabsTrigger>
                    <TabsTrigger value="lines">Line items</TabsTrigger>
                  </TabsList>

                  <TabsContent value="questionnaire" className="mt-6 space-y-4">
                    <LeadDetailsCard 
                      lead={lead}
                      questionnaireAnswers={questionnaireAnswers}
                    />
                    
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

                    <ClientQuoteUploadCard
                      files={quote?.clientQuoteFiles}
                      onUpload={handleUploadClientQuoteFiles}
                      onOpen={handleOpenClientQuoteFile}
                      isUploading={isUploadingClientQuote}
                    />
                  </TabsContent>

                  <TabsContent value="supplier" className="mt-6 space-y-4">
                    <SupplierFilesCard
                      files={quote?.supplierFiles}
                      onOpen={handleOpenFile}
                      onUpload={handleUploadFiles}
                      onUploadClick={openUploadDialog}
                      isUploading={isUploading}
                    />
                    
                    {(quote?.supplierFiles ?? []).length > 0 && (
                      <div className="rounded-2xl border bg-card p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">Ready to parse?</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Extract line items from your supplier PDFs using ML
                            </p>
                          </div>
                          <Button
                            onClick={handleParse}
                            disabled={isParsing}
                            size="lg"
                            className="gap-2"
                          >
                            {isParsing ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Parsing...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4" />
                                Parse supplier PDFs
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="lines" className="mt-6 space-y-4">
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
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right: Sticky estimate sidebar */}
              <div>
                <QuoteEstimateSidebar
                  quote={quote}
                  estimate={estimate}
                  linesCount={lines?.length ?? 0}
                  filesCount={quote?.supplierFiles?.length ?? 0}
                  currency={currency}
                  isEstimating={isEstimating}
                  isRendering={isRendering}
                  isUploading={isUploading}
                  onEstimate={handleQuestionnaireEstimate}
                  onRenderProposal={handleRenderProposal}
                  onUploadClick={openUploadDialog}
                  reestimate={Boolean(reestimateNeeded)}
                  lastEstimateAt={lastEstimateAt}
                  cacheHit={estimate?.meta?.cacheHit}
                  latencyMs={estimate?.meta?.latencyMs ?? null}
                />
              </div>
            </div>
          )}
        </div>

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
                    
                    // Step 1: Process the supplier PDF
                    const resp = await processQuoteFromFile(quoteId, file, {
                      markupPercent,
                      vatPercent,
                      markupDelivery,
                      amalgamateDelivery,
                      clientDeliveryGBP: clientDeliveryCharge > 0 ? clientDeliveryCharge : undefined,
                      clientDeliveryDescription: clientDeliveryCharge > 0 ? "Delivery" : undefined,
                    });
                    
                    setProcessDialogOpen(false);
                    
                    if ((resp as any)?.quote_type === "supplier" && (resp as any)?.client_quote?.grand_total != null) {
                      const gt = (resp as any).client_quote.grand_total as number;
                      
                      // Step 2: Auto-save the lines
                      toast({
                        title: "Converting to client quote",
                        description: `Saving lines and generating proposal...`,
                      });
                      
                      await saveClientQuoteLines(quoteId, (resp as any).client_quote, { replace: true });
                      await Promise.all([mutateQuote(), mutateLines()]);
                      
                      // Step 3: Auto-render the proposal PDF
                      setIsRendering(true);
                      try {
                        await apiFetch(`/quotes/${encodeURIComponent(quoteId)}/render-proposal`, {
                          method: "POST",
                        });
                        await mutateQuote();
                        toast({
                          title: "Client quote ready! 🎉",
                          description: `Grand total ${formatCurrency(gt, currency)}. Beautiful proposal generated!`,
                        });
                      } catch (renderErr: any) {
                        toast({ 
                          title: "Lines saved, but proposal render failed", 
                          description: renderErr?.message || "Try clicking 'Render proposal' button",
                          variant: "destructive" 
                        });
                      } finally {
                        setIsRendering(false);
                      }
                    } else if ((resp as any)?.quote_type === "client") {
                      toast({ title: "Client quote detected", description: "Added as training candidate." });
                    } else {
                      toast({ title: "Processing complete", description: "Could not classify confidently." });
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

      <Dialog open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pricing breakdown</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-lg bg-muted/40 p-4 text-xs">
            {JSON.stringify(pricingBreakdown ?? {}, null, 2)}
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

