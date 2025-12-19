"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ParsedLinesTable } from "@/components/quotes/ParsedLinesTable";
import { SupplierFilesCard } from "@/components/quotes/SupplierFilesCard";
import { TemplatePickerDialog } from "@/components/quotes/TemplatePickerDialog";
import { LeadDetailsCard } from "@/components/quotes/LeadDetailsCard";
import { ClientQuoteUploadCard } from "@/components/quotes/ClientQuoteUploadCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Printer, ChevronDown, ChevronRight, Download, FileText, Building2, Cpu, Edit3, Eye, FileUp, Mail, Save } from "lucide-react";
import {
  fetchQuote,
  fetchParsedLines,
  parseSupplierPdfs,
  generateMlEstimate,
  uploadSupplierPdf,
  uploadClientQuotePdf,
  saveQuoteMappings,
  updateQuoteLine,
  createQuoteLine,
  normalizeQuestionnaireFields,
  processQuoteFromFile,
  saveClientQuoteLines,
  priceQuoteFromQuestionnaire,
  updateQuoteSource,
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
import { deriveLineMaterialAlerts, groupAlerts, type GroupedAlert } from "@/lib/materialAlerts";

// Material cost alert types imported from helper; interface here intentionally omitted.

export default function QuoteBuilderPage() {
  const params = useParams();
  const quoteId = String(params?.id ?? "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  // Product tab: standard field draft state
  const [newLineDesc, setNewLineDesc] = useState("");
  const [newLineQty, setNewLineQty] = useState<number | null>(1);
  const [newLineUnitPrice, setNewLineUnitPrice] = useState<number | null>(0);
  const [stdWidthMm, setStdWidthMm] = useState<number | null>(null);
  const [stdHeightMm, setStdHeightMm] = useState<number | null>(null);
  const [stdTimber, setStdTimber] = useState<string>("");
  const [stdFinish, setStdFinish] = useState<string>("");
  const [stdIronmongery, setStdIronmongery] = useState<string>("");
  const [stdGlazing, setStdGlazing] = useState<string>("");

  const {
    data: quote,
    error: quoteError,
    isLoading: quoteLoading,
    mutate: mutateQuote,
  } = useSWR<QuoteDto>(quoteId ? ["quote", quoteId] : null, () => fetchQuote(quoteId), { revalidateOnFocus: false });

  const {
    data: linesData,
    error: linesError,
    isLoading: linesLoading,
    mutate: mutateLines,
  } = useSWR<{ lines: ParsedLineDto[]; imageUrlMap: Record<string, string> }>(
    quoteId ? ["quote-lines", quoteId] : null, 
    () => fetchParsedLines(quoteId), 
    { revalidateOnFocus: false }
  );
  
  const lines = linesData?.lines ?? [];
  const imageUrlMap = linesData?.imageUrlMap ?? {};

  const {
    data: questionnaireFields = [],
  } = useSWR<QuestionnaireField[]>(quote ? ["tenant-questionnaire", quote.tenantId] : null, async () => {
    // Load legacy settings-based questionnaire config
    const settings = await apiFetch<any>("/tenant/settings");
    const settingsFields = normalizeQuestionnaireFields(settings?.questionnaire);

    // Load DB-backed standard + custom fields (auto-upsert happens in /fields route)
    let dbFieldsRaw: any[] = [];
    try {
      dbFieldsRaw = await apiFetch<any>("/fields");
    } catch (e) {
      // Non-fatal: keep using settings-only if /fields unavailable
      console.warn("[quote-builder] /fields fetch failed", (e as any)?.message || e);
    }

    const dbFields: QuestionnaireField[] = Array.isArray(dbFieldsRaw)
      ? dbFieldsRaw.map((f: any) => {
          const key = typeof f?.key === "string" ? f.key : null;
          if (!key) return null;
          return {
            key,
            label: typeof f?.label === "string" && f.label ? f.label : key,
            type: String(f?.type || "text").toLowerCase(),
            group: typeof f?.group === "string" && f.group ? f.group : null,
            description: typeof f?.helpText === "string" ? f.helpText : null,
            options: Array.isArray(f?.options)
              ? f.options.map((o: any) => String(o || "").trim()).filter(Boolean)
              : undefined,
            askInQuestionnaire: f?.isHidden !== true, // hide if explicitly hidden
            internalOnly: f?.isHidden === true, // treat hidden as internal-only for legacy UI filters
            required: f?.required === true,
          } as QuestionnaireField;
        }).filter(Boolean as any)
      : [];

    // Merge by key; prefer settings metadata (so legacy grouping/ordering persists)
    const mergedMap = new Map<string, QuestionnaireField>();
    for (const sf of settingsFields) mergedMap.set(sf.key, sf);
    for (const df of dbFields) {
      if (!mergedMap.has(df.key)) mergedMap.set(df.key, df);
    }
    const merged = Array.from(mergedMap.values());

    // Sort: first by required, then by original appearance (settings order preserved), then fallback alphabetical
    merged.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (b.required && !a.required) return 1;
      const ai = settingsFields.findIndex((f) => f.key === a.key);
      const bi = settingsFields.findIndex((f) => f.key === b.key);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.key.localeCompare(b.key);
    });

    return merged;
  });

  const leadId = quote?.leadId ?? null;
  const { data: lead } = useSWR<any>(leadId ? ["lead", leadId] : null, async () => {
    const res = await apiFetch<{ lead: any }>(`/leads/${leadId}`);
    return res?.lead ?? res ?? null;
  });

  const [activeTab, setActiveTab] = useState<string>("details");

  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [parseMeta, setParseMeta] = useState<ParseResponse | null>(null);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [lastEstimateAt, setLastEstimateAt] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isTemplatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [isTemplateSelectionSaving, setTemplateSelectionSaving] = useState(false);
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
  // Renamed to avoid potential duplicate identifier in CI build
  const [showMaterialAlerts, setShowMaterialAlerts] = useState(true);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [markupPercent, setMarkupPercent] = useState<number>(20);
  const [vatPercent, setVatPercent] = useState<number>(20);
  const [markupDelivery, setMarkupDelivery] = useState<boolean>(false);
  const [amalgamateDelivery, setAmalgamateDelivery] = useState<boolean>(true);
  const [clientDeliveryCharge, setClientDeliveryCharge] = useState<number>(0);
  const [lineRevision, setLineRevision] = useState(0);
  const [estimatedLineRevision, setEstimatedLineRevision] = useState<number | null>(null);
  const lastLineSnapshotRef = useRef<string | null>(null);
  const [isParsingOwnQuote, setIsParsingOwnQuote] = useState(false);
  const [isUploadingOwnQuote, setIsUploadingOwnQuote] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [advancedToolsOpen, setAdvancedToolsOpen] = useState(false);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);

  // Product Configuration state (Option B unified questions)
  const [productCategories, setProductCategories] = useState<any[]>([]);
  const [selectedProductOptionId, setSelectedProductOptionId] = useState<string | null>(null);
  const [configQuestions, setConfigQuestions] = useState<any[]>([]);
  const [configAnswers, setConfigAnswers] = useState<Record<string, any>>({});

  // (Removed duplicate recent material cost fetch + basic alert derivation)

  const questionnaireAnswers = useMemo(() => {
    if (!lead?.custom) return {};
    return { ...(lead.custom as Record<string, any>) };
  }, [lead]);

  const currency = quote?.currency ?? "GBP";
  const tenantName = quote?.tenant?.name ?? null;
  const quoteStatus = quote?.status ?? null;
  const proposalPdfUrl = (quote?.meta as any)?.proposalPdfUrl ?? quote?.proposalPdfUrl ?? null;

  // Fetch recent material costs (tenant-scoped indirectly via server auth)
  const { data: recentMaterialCosts = [] } = useSWR<any[]>(
    quote ? ["recent-material-costs", quote.tenantId] : null,
    async () => {
      const res = await apiFetch<{ costs: any[] }>("/ml/material-costs/recent");
      return res?.costs || [];
    },
    { revalidateOnFocus: false }
  );

  // Compute alerts (grouped) with env-config thresholds
  const envMinPercent = typeof process.env.NEXT_PUBLIC_MATERIAL_MIN_CHANGE_PERCENT === 'string' ? Number(process.env.NEXT_PUBLIC_MATERIAL_MIN_CHANGE_PERCENT) : 3;
  const envFuzzyThreshold = typeof process.env.NEXT_PUBLIC_MATERIAL_FUZZY_THRESHOLD === 'string' ? Number(process.env.NEXT_PUBLIC_MATERIAL_FUZZY_THRESHOLD) : 0.82;
  const lineMaterialAlerts: GroupedAlert[] = useMemo(() => {
    const raw = deriveLineMaterialAlerts(lines, recentMaterialCosts as any, { minPercent: envMinPercent, fuzzyThreshold: envFuzzyThreshold });
    return groupAlerts(raw);
  }, [lines, recentMaterialCosts, envMinPercent, envFuzzyThreshold]);

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
      const templateMeta = lastParse?.template ?? null;
      if (lastParse?.message) {
        setNotice(lastParse.message);
      } else if (Array.isArray(lastParse?.warnings) && lastParse.warnings.length > 0) {
        setNotice(lastParse.warnings.join(" \u2022 "));
      } else if (templateMeta?.method === "template_failed") {
        setNotice("Saved layout template didn't match this PDF, so we used the fallback parser.");
      } else if (templateMeta?.method === "template") {
        const matched = typeof templateMeta?.matchedRows === "number" ? templateMeta.matchedRows : null;
        const label = templateMeta?.name || "layout template";
        setNotice(
          matched && matched > 0
            ? `${label} matched ${matched} rows automatically.`
            : `${label} was applied successfully.`
        );
      } else if (
        typeof lastParse?.fallbackScored?.discarded === "number" &&
        ((typeof lastParse?.fallbackScored?.kept === "number" &&
          lastParse.fallbackScored.discarded > lastParse.fallbackScored.kept) ||
          lastParse.fallbackScored.discarded > 10)
      ) {
        setNotice("We discarded a lot of dubious rows from this PDF parse. Review the remaining lines carefully.");
      } else if (lastParse?.quality === "poor") {
        setNotice("Parser flagged this quote as low quality. Review extracted lines before sending.");
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

  // Load product types and derive configQuestions based on selected option
  const { data: tenantSettings } = useSWR(
    quote ? ["tenant-settings-product-config", quote.tenantId] : null,
    async () => {
      const settings = await apiFetch<{ productTypes?: any[]; questionnaire?: any[] }>("/tenant/settings");
      return settings;
    },
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (tenantSettings?.productTypes && Array.isArray(tenantSettings.productTypes)) {
      setProductCategories(tenantSettings.productTypes);
      // Initialize from quote metadata if available
      const savedOptionId = (quote?.meta as any)?.selectedProductOptionId;
      if (savedOptionId) setSelectedProductOptionId(savedOptionId);
      const savedAnswers = (quote?.meta as any)?.configAnswers || {};
      setConfigAnswers(savedAnswers);
    }
  }, [tenantSettings?.productTypes, quote?.meta]);

  // Derive configQuestions when selected product option changes
  useEffect(() => {
    if (!selectedProductOptionId || !productCategories.length) {
      setConfigQuestions([]);
      return;
    }
    let found: any = null;
    for (const cat of productCategories) {
      if (cat.types && Array.isArray(cat.types)) {
        for (const type of cat.types) {
          if (type.options && Array.isArray(type.options)) {
            const opt = type.options.find((o: any) => o.id === selectedProductOptionId);
            if (opt) {
              found = opt;
              break;
            }
          }
        }
      }
      if (found) break;
    }
    setConfigQuestions(found?.configQuestions || []);
  }, [selectedProductOptionId, productCategories]);

  // Persist product configuration to quote metadata and optionally add a line with standard fields
  const saveProductConfiguration = useCallback(async () => {
    if (!quoteId || !quote) return;
    try {
      const nextMeta = {
        ...((quote?.meta as any) || {}),
        selectedProductOptionId,
        configAnswers,
      };
      await apiFetch(`/quotes/${encodeURIComponent(quoteId)}`, {
        method: "PATCH",
        json: { meta: nextMeta },
      });
      await mutateQuote();

      // If user filled in standard fields, add a line now
      if (newLineDesc.trim()) {
        const created = await createQuoteLine(quoteId, {
          description: newLineDesc.trim(),
          quantity: newLineQty ?? 1,
          unitPrice: newLineUnitPrice ?? 0,
        });
        const lineId = (created as any)?.line?.id;
        if (lineId) {
          const lineStandard: Record<string, any> = {};
          if (stdWidthMm != null) lineStandard.widthMm = stdWidthMm;
          if (stdHeightMm != null) lineStandard.heightMm = stdHeightMm;
          if (stdTimber) lineStandard.timber = stdTimber;
          if (stdFinish) lineStandard.finish = stdFinish;
          if (stdIronmongery) lineStandard.ironmongery = stdIronmongery;
          if (stdGlazing) lineStandard.glazing = stdGlazing;
          if (selectedProductOptionId) lineStandard.productOptionId = selectedProductOptionId;
          if (Object.keys(lineStandard).length > 0) {
            await updateQuoteLine(quoteId, lineId, { lineStandard });
          }
          await mutateLines();
          // Reset drafts
          setNewLineDesc("");
          setNewLineQty(1);
          setNewLineUnitPrice(0);
          setStdWidthMm(null);
          setStdHeightMm(null);
          setStdTimber("");
          setStdFinish("");
          setStdIronmongery("");
          setStdGlazing("");
          setActiveTab("quote-lines");
          toast({ title: "Line added", description: "Product line created and saved." });
        }
      } else {
        toast({ title: "Product configuration saved" });
      }
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "", variant: "destructive" });
    }
  }, [quoteId, quote, selectedProductOptionId, configAnswers, mutateQuote, newLineDesc, newLineQty, newLineUnitPrice, stdWidthMm, stdHeightMm, stdTimber, stdFinish, stdIronmongery, stdGlazing, mutateLines, toast]);

  const reestimateNeeded = estimate && estimatedLineRevision !== null && estimatedLineRevision !== lineRevision;

  const runSupplierProcessing = useCallback(async () => {
    if (!quoteId) return;
    if (!quote?.supplierFiles?.length) {
      toast({
        title: "No files to parse",
        description: "Upload supplier PDFs first",
        variant: "destructive",
      });
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      const result = await apiFetch<{ lines: ParsedLineDto[]; count: number }>(
        `/quotes/${encodeURIComponent(quoteId)}/process-supplier`,
        {
          method: "POST",
          json: {
            convertCurrency: true,
            distributeDelivery: true,
            hideDeliveryLine: true,
            applyMarkup: true,
          },
        }
      );

      toast({
        title: "Supplier quote processed",
        description: `${result.count} line items ready with markup applied`,
      });

      await Promise.all([mutateQuote(), mutateLines()]);
      setActiveTab("quote-lines");
    } catch (err: any) {
      setError(err?.message || "Failed to parse supplier PDFs");
      toast({
        title: "Parse failed",
        description: err?.message || "Unable to parse supplier files",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  }, [quoteId, quote?.supplierFiles, mutateQuote, mutateLines, toast]);

  const handleParse = useCallback(() => {
    if (!quoteId || !quote?.supplierFiles?.length) {
      toast({
        title: "No files to parse",
        description: "Upload supplier PDFs first",
        variant: "destructive",
      });
      return;
    }
    if (isParsing || isTemplateSelectionSaving) return;
    setTemplatePickerOpen(true);
  }, [quoteId, quote?.supplierFiles, toast, isParsing, isTemplateSelectionSaving]);

  const handleTemplateConfirm = useCallback(
    async ({ sourceType, profileId }: { sourceType: "supplier" | "software" | null; profileId: string | null }) => {
      if (!quoteId) return;
      setTemplateSelectionSaving(true);
      const nextSource = sourceType ?? null;
      const nextProfile = profileId ?? null;
      const prevSource = quote?.quoteSourceType ?? null;
      const prevProfile = quote?.supplierProfileId ?? null;

      try {
        if (nextSource !== prevSource || nextProfile !== prevProfile) {
          await updateQuoteSource(quoteId, nextSource, nextProfile);
          await mutateQuote();
        }
        setTemplatePickerOpen(false);
        await runSupplierProcessing();
      } catch (err: any) {
        const message = err?.message || "Failed to save template selection";
        setError(message);
        toast({ title: "Template picker failed", description: message, variant: "destructive" });
      } finally {
        setTemplateSelectionSaving(false);
      }
    },
    [quoteId, quote?.quoteSourceType, quote?.supplierProfileId, mutateQuote, runSupplierProcessing, toast],
  );

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

  const handleUploadOwnQuote = useCallback(
    async (files: FileList | null) => {
      if (!quoteId || !files || files.length === 0) return;
      setIsUploadingOwnQuote(true);
      setError(null);
      try {
        // Upload files as supplier files
        for (const file of Array.from(files)) {
          await uploadSupplierPdf(quoteId, file);
        }
        
        // Parse without transformations
        const res = await apiFetch<{ lines?: ParsedLineDto[]; count?: number }>(`/quotes/${encodeURIComponent(quoteId)}/process-supplier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            convertCurrency: false,
            distributeDelivery: false,
            hideDeliveryLine: false,
            applyMarkup: false,
          }),
        });
        
        toast({ 
          title: "Own quote processed", 
          description: `${res.count} line items extracted without modifications` 
        });
        
        await Promise.all([mutateQuote(), mutateLines()]);
        setActiveTab("quote-lines");
      } catch (err: any) {
        setError(err?.message || "Upload failed");
        toast({ 
          title: "Upload failed", 
          description: err?.message || "Unable to process own quote", 
          variant: "destructive" 
        });
      } finally {
        setIsUploadingOwnQuote(false);
      }
    },
    [quoteId, mutateQuote, mutateLines, toast],
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
    if (!leadId) {
      toast({
        title: "Cannot generate estimate",
        description: "Quote must be linked to a lead to generate ML estimates",
        variant: "destructive",
      });
      return;
    }
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
    async (lineId: string, payload: { qty?: number | null; unitPrice?: number | null; lineStandard?: Record<string, any> }) => {
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

  const handleGenerateQuotePdf = useCallback(async () => {
    if (!quoteId || !lines.length) {
      toast({
        title: "Cannot generate PDF",
        description: "No line items to include in quote",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPdf(true);
    setError(null);

    try {
      await apiFetch(`/quotes/${encodeURIComponent(quoteId)}/render-pdf`, {
        method: "POST",
      });

      await mutateQuote();

      toast({
        title: "PDF generated",
        description: "Quote PDF is ready for preview",
      });

      // Auto-navigate to preview tab
      setActiveTab("preview");
    } catch (err: any) {
      setError(err?.message || "Failed to generate PDF");
      toast({
        title: "PDF generation failed",
        description: err?.message || "Unable to generate quote PDF",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [quoteId, lines, mutateQuote, toast]);

  const handleEmailToClient = useCallback(async () => {
    if (!quoteId || !lead?.email) {
      toast({
        title: "Cannot send email",
        description: lead ? "Client email address is required" : "Quote is not linked to a lead",
        variant: "destructive",
      });
      return;
    }

    const pdfUrl = (quote?.meta as any)?.proposalPdfUrl ?? quote?.proposalPdfUrl ?? null;
    if (!pdfUrl) {
      toast({
        title: "No PDF to send",
        description: "Generate a PDF first from the Quote Lines tab",
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmail(true);

    try {
      await apiFetch(`/quotes/${encodeURIComponent(quoteId)}/send-email`, {
        method: "POST",
        json: {
          to: lead.email,
          subject: `Your quote from ${tenantName || 'us'}`,
          includeAttachment: true,
        },
      });

      toast({
        title: "Email sent",
        description: `Quote sent to ${lead.email}`,
      });

      await mutateQuote();
    } catch (err: any) {
      toast({
        title: "Email failed",
        description: err?.message || "Unable to send email",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  }, [quoteId, lead, quote?.meta, quote?.proposalPdfUrl, tenantName, mutateQuote, toast]);

  const handleDownloadPdf = useCallback(() => {
    const pdfUrl = (quote?.meta as any)?.proposalPdfUrl ?? quote?.proposalPdfUrl ?? null;
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  }, [quote?.meta, quote?.proposalPdfUrl]);

  const handlePrintPdf = useCallback(() => {
    const pdfUrl = (quote?.meta as any)?.proposalPdfUrl ?? quote?.proposalPdfUrl ?? null;
    if (pdfUrl) {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = pdfUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.print();
      };
    }
  }, [quote?.meta, quote?.proposalPdfUrl]);

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

  // UI state for collapsible sections (defined earlier in state section)

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

  // Grouped questionnaire fields (client-level vs item-level)
  const clientProfileFields = questionnaireFields.filter(
    (f) => f.group === "Client Profile" && f.askInQuestionnaire !== false && !f.internalOnly,
  );
  const itemSpecificationFields = questionnaireFields.filter(
    (f) => f.group === "Item Specification" && f.askInQuestionnaire !== false && !f.internalOnly,
  );
  // Short key summary for top section: prioritize selected client profile essentials
  const keyQuestionnaireFields = clientProfileFields.slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-6 lg:py-8">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(event) => handleUploadFiles(event.target.files)}
      />
      
      <div className="space-y-8">
        {/* ========== PROJECT OVERVIEW ========== */}
        <div className="space-y-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">{breadcrumbs}</div>
          
          {/* Header with actions */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-foreground">
                {quote?.title ?? "Quote Builder"}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {tenantName && <span className="font-medium text-foreground">{tenantName}</span>}
                {quote?.updatedAt && (
                  <span>Last updated {new Date(quote.updatedAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/quotes" className="inline-flex">
                <Button variant="outline" size="sm" className="gap-2">
                  + New Quote
                </Button>
              </Link>
              <Link href={`/quotes/${quoteId}/print`} target="_blank">
                <Button variant="outline" size="sm" className="gap-2">
                  <Printer className="h-4 w-4" />
                  Print quote sheet
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Notices */}
        {errorBanner}
        {noticeBanner}

        {quoteLoading || linesLoading ? (
          <div className="space-y-6">
            <div className="h-48 rounded-2xl bg-muted/40 animate-pulse"></div>
            <div className="h-96 rounded-2xl bg-muted/40 animate-pulse"></div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-7 h-auto">
              <TabsTrigger value="details" className="flex flex-col gap-1 py-3">
                <FileText className="h-4 w-4" />
                <span className="text-xs">Details</span>
              </TabsTrigger>
              <TabsTrigger value="product-config" className="flex flex-col gap-1 py-3">
                <Building2 className="h-4 w-4" />
                <span className="text-xs">Product</span>
              </TabsTrigger>
              <TabsTrigger value="supplier" className="flex flex-col gap-1 py-3">
                <FileUp className="h-4 w-4" />
                <span className="text-xs">Supplier</span>
              </TabsTrigger>
              <TabsTrigger value="own-quote" className="flex flex-col gap-1 py-3">
                <FileUp className="h-4 w-4" />
                <span className="text-xs">Own Quote</span>
              </TabsTrigger>
              <TabsTrigger value="ml-estimate" className="flex flex-col gap-1 py-3">
                <Cpu className="h-4 w-4" />
                <span className="text-xs">ML Estimate</span>
              </TabsTrigger>
              <TabsTrigger value="quote-lines" className="flex flex-col gap-1 py-3">
                <Edit3 className="h-4 w-4" />
                <span className="text-xs">Quote Lines</span>
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex flex-col gap-1 py-3">
                <Eye className="h-4 w-4" />
                <span className="text-xs">Preview</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
              <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground mb-2">Client & project details</h2>
                  <p className="text-sm text-muted-foreground">
                    Core information about the client and project requirements
                  </p>
                </div>

                <LeadDetailsCard 
                  lead={lead}
                  questionnaireAnswers={questionnaireAnswers}
                />

                {/* Client Profile summary */}
                {keyQuestionnaireFields.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Client profile summary
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {keyQuestionnaireFields.map((field) => {
                        const value = questionnaireAnswers[field.key];
                        if (value == null || value === "") return null;
                        return (
                          <div key={field.key} className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">{field.label}</div>
                            <div className="text-sm text-foreground">
                              {Array.isArray(value) ? value.join(", ") : String(value)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Item specification snapshot (per-item attributes) */}
                {itemSpecificationFields.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Item specification (global defaults)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      These attributes apply to generated / estimated items unless overridden on individual line items.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {itemSpecificationFields.slice(0, 6).map((field) => {
                        const value = questionnaireAnswers[field.key];
                        if (value == null || value === "") return null;
                        return (
                          <div key={field.key} className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">{field.label}</div>
                            <div className="text-sm text-foreground">
                              {Array.isArray(value) ? value.join(", ") : String(value)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Full questionnaire removed (no longer used) */}
              </div>
            </TabsContent>

            <TabsContent value="product-config" className="space-y-6">
              <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground mb-2">Product Configuration</h2>
                  <p className="text-sm text-muted-foreground">
                    Select a product type and answer configuration questions
                  </p>
                </div>

                {/* Product option selector */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground">Select Product Type/Option</label>
                  <select
                    className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={selectedProductOptionId || ""}
                    onChange={(e) => setSelectedProductOptionId(e.target.value || null)}
                  >
                    <option value="">— Select a product —</option>
                    {productCategories.map((cat: any) => {
                      if (!cat.types || !Array.isArray(cat.types)) return null;
                      return cat.types.map((type: any) => {
                        if (!type.options || !Array.isArray(type.options)) return null;
                        return type.options.map((opt: any) => (
                          <option key={opt.id} value={opt.id}>
                            {cat.label} › {type.label} › {opt.label}
                          </option>
                        ));
                      });
                    })}
                  </select>
                </div>

                {/* Configuration questions - Grid layout */}
                {selectedProductOptionId && configQuestions.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-foreground">Configuration Questions</div>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            {configQuestions.map((q: any, idx: number) => {
                              const label = q.label || (q.source === "legacy" ? (q as any).fieldKey : (q as any).attributeName);
                              return (
                                <th key={idx} className="px-4 py-2 text-left text-xs font-semibold text-foreground whitespace-nowrap border-r last:border-r-0">
                                  {label}
                                  {q.required && <span className="text-red-500 ml-1">*</span>}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b last:border-b-0">
                            {configQuestions.map((q: any, idx: number) => {
                              const key = q.source === "legacy" ? (q as any).fieldKey : `${(q as any).componentType}:${(q as any).attributeName}`;
                              return (
                                <td key={idx} className="px-4 py-2 border-r last:border-r-0">
                                  <Input
                                    type="text"
                                    value={configAnswers[key] || ""}
                                    onChange={(e) =>
                                      setConfigAnswers((prev) => ({ ...prev, [key]: e.target.value }))
                                    }
                                    placeholder="—"
                                    className="h-8 text-sm"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedProductOptionId && configQuestions.length === 0 && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">No questions configured for this product type.</p>
                  </div>
                )}

                {!selectedProductOptionId && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Select a product type to view configuration questions.</p>
                  </div>
                )}

                {/* Standard fields + Add row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Description</label>
                    <Input
                      value={newLineDesc}
                      onChange={(e) => setNewLineDesc(e.target.value)}
                      placeholder="e.g. Oak door - primed"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Qty</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={newLineQty ?? ''}
                      min={1}
                      onChange={(e) => setNewLineQty(e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Unit price (£)</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={newLineUnitPrice ?? ''}
                      min={0}
                      onChange={(e) => setNewLineUnitPrice(e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Width (mm)</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={stdWidthMm ?? ''}
                      onChange={(e) => setStdWidthMm(e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Height (mm)</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={stdHeightMm ?? ''}
                      onChange={(e) => setStdHeightMm(e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Timber</label>
                    <select
                      className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={stdTimber || ''}
                      onChange={(e) => setStdTimber(e.target.value || '')}
                    >
                      <option value="">— Select —</option>
                      <option value="oak">Oak</option>
                      <option value="sapele">Sapele</option>
                      <option value="accoya">Accoya</option>
                      <option value="iroko">Iroko</option>
                      <option value="pine">Pine</option>
                      <option value="hemlock">Hemlock</option>
                      <option value="mdf">MDF</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Finish</label>
                    <select
                      className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={stdFinish || ''}
                      onChange={(e) => setStdFinish(e.target.value || '')}
                    >
                      <option value="">— Select —</option>
                      <option value="primed">Primed</option>
                      <option value="painted">Painted</option>
                      <option value="stained">Stained</option>
                      <option value="clear_lacquer">Clear Lacquer</option>
                      <option value="wax">Wax</option>
                      <option value="oiled">Oiled</option>
                      <option value="unfinished">Unfinished</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Ironmongery</label>
                    <select
                      className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={stdIronmongery || ''}
                      onChange={(e) => setStdIronmongery(e.target.value || '')}
                    >
                      <option value="">— Select —</option>
                      <option value="none">None</option>
                      <option value="hinges">Hinges</option>
                      <option value="handles">Handles</option>
                      <option value="locks">Locks</option>
                      <option value="full_set">Full Set</option>
                      <option value="fire_rated">Fire Rated</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Glazing</label>
                    <select
                      className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={stdGlazing || ''}
                      onChange={(e) => setStdGlazing(e.target.value || '')}
                    >
                      <option value="">— Select —</option>
                      <option value="none">None</option>
                      <option value="clear">Clear Glass</option>
                      <option value="obscure">Obscure Glass</option>
                      <option value="double_glazed">Double Glazed</option>
                      <option value="fire_rated">Fire Rated Glass</option>
                      <option value="georgian">Georgian</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveProductConfiguration} className="gap-2">
                    <Save className="h-4 w-4" />
                    Add line from product
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="supplier" className="space-y-6">
              <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground mb-2">Supplier quote upload & parsing</h2>
                  <p className="text-sm text-muted-foreground">
                    Upload supplier PDFs and extract line items using ML
                  </p>
                </div>

                <SupplierFilesCard
                  files={quote?.supplierFiles}
                  quoteId={quoteId}
                  quoteSourceType={quote?.quoteSourceType}
                  supplierProfileId={quote?.supplierProfileId}
                  onOpen={handleOpenFile}
                  onUpload={handleUploadFiles}
                  onUploadClick={openUploadDialog}
                  isUploading={isUploading}
                  onSourceUpdated={() => {
                    void mutateQuote();
                  }}
                />

                {(quote?.supplierFiles ?? []).length > 0 && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-muted/30 rounded-xl">
                    <div>
                      <h3 className="font-medium text-foreground mb-1">Parse supplier PDFs</h3>
                      <p className="text-sm text-muted-foreground">
                        Extract line items and pricing using ML
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
                          Parse & build estimate
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {lines && lines.length > 0 && (
                  <div className="text-center py-4">
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => setActiveTab("quote-lines")}
                    >
                      <FileText className="h-4 w-4" />
                      View {lines.length} parsed line item{lines.length !== 1 ? 's' : ''} →
                    </Button>
                  </div>
                )}

                {/* Advanced tools (collapsible) */}
                {lines && lines.length > 0 && (
                  <div className="space-y-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => setAdvancedToolsOpen(!advancedToolsOpen)}
                    >
                      <span className="text-xs text-muted-foreground">Advanced tools</span>
                      {advancedToolsOpen ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </Button>
                    {advancedToolsOpen && (
                      <div className="mt-4 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadCsv}
                            className="gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Download CSV
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRawParseOpen(true)}
                            className="gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            View raw parse
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="own-quote" className="space-y-6">
              <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground mb-2">Upload your own quote</h2>
                  <p className="text-sm text-muted-foreground">
                    Upload a quote you've already created. We'll parse it and make it beautiful.
                    No currency conversion, markup, or delivery distribution applied - just clean formatting.
                  </p>
                </div>

                {/* Info box */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">
                    How it works
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Upload your PDF quote (no transformations applied)</li>
                    <li>Delivery charges kept as separate line items</li>
                    <li>Original pricing preserved exactly as-is</li>
                    <li>Perfect for quotes you've manually created</li>
                  </ul>
                </div>

                {/* Upload area */}
                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => handleUploadOwnQuote(e.target.files)}
                    className="hidden"
                  />
                  
                  <div 
                    className="text-center py-8 border-2 border-dashed border-muted rounded-xl hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="h-12 w-12 mx-auto mb-4 opacity-40" />
                    <h3 className="text-lg font-medium mb-2">Upload your quote</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Click to browse or drag PDF files here
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      disabled={isUploadingOwnQuote}
                    >
                      {isUploadingOwnQuote ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <FileUp className="h-4 w-4 mr-2" />
                          Select PDF
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {quote?.supplierFiles && quote.supplierFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Uploaded files:</h4>
                      {quote.supplierFiles.map((file) => (
                        <div key={file.id} className="flex items-center gap-2 text-sm p-2 rounded border">
                          <FileText className="h-4 w-4" />
                          <span>{file.name}</span>
                          <span className="text-muted-foreground">
                            ({(file.sizeBytes ? file.sizeBytes / 1024 : 0).toFixed(1)} KB)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ml-estimate" className="space-y-6">
              <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground mb-2">ML estimate & pricing</h2>
                  <p className="text-sm text-muted-foreground">
                    Generate AI-powered estimates from questionnaire answers and existing line items
                  </p>
                </div>

                {/* Info box explaining what ML uses */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">
                    How ML estimation works
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Analyzes your questionnaire answers from the Details tab</li>
                    <li>Considers existing line items (if any from Supplier or Own Quote)</li>
                    <li>Predicts pricing based on historical data and patterns</li>
                    <li>Adds estimated line items to the Quote Lines tab for review</li>
                  </ul>
                </div>

              {/* Estimate summary */}
              {estimate && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-muted/30 rounded-xl">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Estimated total</div>
                    <div className="text-2xl font-bold text-foreground">
                      {formatCurrency(estimate.estimatedTotal, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Line items</div>
                    <div className="text-2xl font-bold text-foreground">{lines?.length ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Supplier files</div>
                    <div className="text-2xl font-bold text-foreground">{quote?.supplierFiles?.length ?? 0}</div>
                  </div>
                  {estimate.confidence != null && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Confidence</div>
                      <div className="text-2xl font-bold text-foreground">
                        {Math.round(estimate.confidence * 100)}%
                      </div>
                    </div>
                  )}
                </div>
              )}

              {reestimateNeeded && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  ⚠️ Line items have changed since last estimate. Re-run estimate for updated pricing.
                </div>
              )}

              {/* Primary actions */}
              <div className="space-y-4">
                <Button
                  onClick={handleQuestionnaireEstimate}
                  disabled={isEstimating || isPricing || !leadId}
                  size="lg"
                  className="w-full gap-2"
                >
                  {isEstimating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating estimate...
                    </>
                  ) : (
                    <>
                      <Cpu className="h-4 w-4" />
                      Generate ML estimate
                    </>
                  )}
                </Button>

                {!leadId && (
                  <div className="text-sm text-muted-foreground text-center">
                    Quote must be linked to a lead to generate ML estimates
                  </div>
                )}

                {estimate && lines.length > 0 && (
                  <div className="text-center">
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("quote-lines")}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      View {lines.length} estimated line items →
                    </Button>
                  </div>
                )}
              </div>

              {/* Metadata */}
              {lastEstimateAt && (
                <div className="text-xs text-muted-foreground text-center">
                  Last estimate: {new Date(lastEstimateAt).toLocaleString()}
                  {estimate?.meta?.cacheHit && " (cached)"}
                  {estimate?.meta?.latencyMs && ` · ${estimate.meta.latencyMs}ms`}
                </div>
              )}

              {pricingBreakdown && (
                <div className="text-center">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setBreakdownOpen(true)}>
                    <Sparkles className="h-4 w-4" />
                    View detailed pricing breakdown
                  </Button>
                </div>
              )}

              {lines && lines.length > 0 && (
                <div className="text-center py-4">
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={() => setActiveTab("quote-lines")}
                  >
                    <Edit3 className="h-4 w-4" />
                    View generated line items →
                  </Button>
                </div>
              )}
              </div>
            </TabsContent>

            <TabsContent value="quote-lines" className="space-y-6">
              {lines && lines.length > 0 ? (
                <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
                  {lineMaterialAlerts.length > 0 && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowMaterialAlerts(!showMaterialAlerts)}
                        className="flex w-full items-center justify-between rounded-xl border bg-muted/40 px-4 py-2 text-left text-sm"
                      >
                        <span className="font-medium text-foreground">
                          {lineMaterialAlerts.length} material cost change{lineMaterialAlerts.length !== 1 ? 's' : ''} affecting this quote
                        </span>
                        {showMaterialAlerts ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      {showMaterialAlerts && (
                        <div className="grid gap-2 md:grid-cols-2">
                          {lineMaterialAlerts.map((mc) => {
                            const pct = mc.changePercent != null ? Math.round(mc.changePercent) : null;
                            const direction = pct != null ? (pct > 0 ? "increase" : pct < 0 ? "decrease" : "no change") : null;
                            return (
                              <div
                                key={mc.id}
                                className="rounded-lg border p-3 text-xs bg-muted/30 flex flex-col gap-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-foreground">
                                    {mc.materialLabel || mc.materialCode || "Material"}
                                  </span>
                                  <span className={
                                    mc.severity === 'major' ? 'rounded-md bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] font-medium' :
                                    mc.severity === 'moderate' ? 'rounded-md bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-medium' :
                                    'rounded-md bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-medium'
                                  }>{mc.severity}</span>
                                  {pct != null && (
                                    <span
                                      className={
                                        pct > 0
                                          ? "text-rose-600 font-medium"
                                          : pct < 0
                                          ? "text-green-600 font-medium"
                                          : "text-muted-foreground"
                                      }
                                    >
                                      {pct > 0 ? `↑${pct}%` : pct < 0 ? `↓${Math.abs(pct)}%` : "0%"}
                                    </span>
                                  )}
                                </div>
                                <div className="text-muted-foreground">
                                  {mc.previousUnitPrice != null && mc.currentUnitPrice != null ? (
                                    <span>
                                      {formatCurrency(mc.previousUnitPrice, mc.currency)} → {formatCurrency(mc.currentUnitPrice, mc.currency)}
                                    </span>
                                  ) : (
                                    <span>Current {formatCurrency(mc.currentUnitPrice, mc.currency)}</span>
                                  )}
                                </div>
                                {direction && direction !== "no change" && (
                                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {direction} impacting pricing
                                  </div>
                                )}
                                {(mc.matchedTokens.length > 0 || mc.matchedCode) && (
                                  <div className="text-[10px] text-muted-foreground">
                                    Match: {mc.matchedCode ? "code" : mc.matchedTokens.join(", ")}
                                  </div>
                                )}
                                {mc.suppliers && mc.suppliers.length > 0 && (
                                  <div className="text-[10px] text-muted-foreground">Suppliers: {mc.suppliers.join(', ')}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold text-foreground mb-2">Quote line items</h2>
                      <p className="text-sm text-muted-foreground">
                        Review and edit line items from all sources (supplier PDFs, ML estimates, manual entry)
                      </p>
                    </div>

                    {/* Generate PDF button */}
                    <Button
                      onClick={handleGenerateQuotePdf}
                      disabled={isGeneratingPdf}
                      size="lg"
                      className="gap-2"
                    >
                      {isGeneratingPdf ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" />
                          Generate PDF quote
                        </>
                      )}
                    </Button>
                  </div>

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
                    imageUrlMap={imageUrlMap}
                    tenantId={quote?.tenantId}
                  />
                </div>
              ) : (
                <div className="rounded-2xl border bg-card p-8 shadow-sm">
                  <div className="text-center text-muted-foreground py-12">
                    <Edit3 className="h-12 w-12 mx-auto mb-4 opacity-40" />
                    <h3 className="text-lg font-medium mb-2">No line items yet</h3>
                    <p className="text-sm mb-4">Parse a supplier quote or generate an ML estimate to create line items</p>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" onClick={() => setActiveTab("supplier")}>
                        Upload supplier quote
                      </Button>
                      <Button variant="outline" onClick={() => setActiveTab("ml-estimate")}>
                        Generate ML estimate
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="preview" className="space-y-6">
              {proposalPdfUrl ? (
                <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold text-foreground mb-2">Quote preview</h2>
                      <p className="text-sm text-muted-foreground">
                        Review the generated quote PDF before sending to client
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleDownloadPdf}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        onClick={handlePrintPdf}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </Button>
                    </div>
                  </div>

                  {/* PDF Preview iframe */}
                  <div className="relative w-full" style={{ height: "600px" }}>
                    <iframe
                      src={proposalPdfUrl}
                      className="w-full h-full rounded-lg border"
                      title="Quote PDF Preview"
                    />
                  </div>

                  {/* Email section */}
                  <div className="border-t pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">Ready to send?</h3>
                        <p className="text-sm text-muted-foreground">
                          Send this quote to the client via email with PDF attachment
                        </p>
                      </div>
                      <Button
                        onClick={handleEmailToClient}
                        disabled={isSendingEmail}
                        size="lg"
                        className="gap-2"
                      >
                        {isSendingEmail ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4" />
                            Email to client
                          </>
                        )}
                      </Button>
                    </div>

                    {estimate && (
                      <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Total</div>
                          <div className="text-lg font-bold text-foreground">
                            {formatCurrency(estimate.estimatedTotal, currency)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Line items</div>
                          <div className="text-lg font-bold text-foreground">{lines?.length ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Status</div>
                          <div className="text-sm font-medium text-foreground capitalize">{quoteStatus ?? "Draft"}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border bg-card p-8 shadow-sm">
                  <div className="text-center text-muted-foreground py-12">
                    <Eye className="h-12 w-12 mx-auto mb-4 opacity-40" />
                    <h3 className="text-lg font-medium mb-2">No PDF generated yet</h3>
                    <p className="text-sm mb-4">Generate a PDF from the Quote Lines tab to preview and send to client</p>
                    <Button variant="outline" onClick={() => setActiveTab("quote-lines")}>
                      Go to Quote Lines
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
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

      <TemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        quoteId={quoteId}
        supplierFiles={quote?.supplierFiles}
        initialSourceType={quote?.quoteSourceType}
        initialProfileId={quote?.supplierProfileId}
        onConfirm={handleTemplateConfirm}
        isSubmitting={isTemplateSelectionSaving || isParsing}
      />
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

