"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ParsedLinesTable } from "@/components/quotes/ParsedLinesTable";
import { LeadDetailsCard } from "@/components/quotes/LeadDetailsCard";
import { ClientQuoteUploadCard } from "@/components/quotes/ClientQuoteUploadCard";
import { UnifiedQuoteLineItems } from "@/components/quotes/UnifiedQuoteLineItems";
import { ProposalEditor } from "@/components/quote/ProposalEditor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Printer, ChevronDown, ChevronRight, Download, FileText, Building2, Cpu, Edit3, Eye, FileUp, Mail, Save, Box, Wand2, X } from "lucide-react";
import { TypeSelectorModal } from "@/components/TypeSelectorModal";
import { AIComponentConfigurator } from "@/components/configurator/AIComponentConfigurator";
import {
  fetchQuote,
  fetchParsedLines,
  generateMlEstimate,
  uploadSupplierPdf,
  uploadOwnQuotePdf,
  uploadClientQuotePdf,
  fillLineStandardFromParsed,
  saveQuoteMappings,
  updateQuoteLine,
  createQuoteLine,
  normalizeQuestionnaireFields,
  processQuoteFromFile,
  saveClientQuoteLines,
  priceQuoteFromQuestionnaire,
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
import { InstantQuoteGenerator } from "@/components/instant-quote/InstantQuoteGenerator";
import { normalizeQuoteDraft } from "@/lib/quoteDraft";

// Material cost alert types imported from helper; interface here intentionally omitted.

export default function QuoteBuilderPage() {
  const params = useParams();
  const quoteId = String(params?.id ?? "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const proposalBasicsInitRef = useRef(false);
  const [proposalBasicsOpen, setProposalBasicsOpen] = useState(true);
  const [proposalScopeDraft, setProposalScopeDraft] = useState<string>("");
  const [proposalSpecsDraft, setProposalSpecsDraft] = useState<{ timber: string; finish: string; glazing: string; fittings: string; ventilation: string }>({
    timber: "",
    finish: "",
    glazing: "",
    fittings: "",
    ventilation: "",
  });
  const [isSavingProposalBasics, setIsSavingProposalBasics] = useState(false);
  
  // Product type picker state
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showAiSearch, setShowAiSearch] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState<string>("");
  const [aiSearching, setAiSearching] = useState(false);
  const [aiClarifications, setAiClarifications] = useState<
    | null
    | Array<{
        question: string;
        options: Array<{ label: string; category: string; type: string; option: string; hint?: string }>;
      }>
  >(null);

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
  const [supplierPreviewFileId, setSupplierPreviewFileId] = useState<string | null>(null);
  const [supplierPreviewUrl, setSupplierPreviewUrl] = useState<string | null>(null);
  const [supplierPreviewLoading, setSupplierPreviewLoading] = useState(false);
  const ownQuoteFileInputRef = useRef<HTMLInputElement | null>(null);
  const [ownQuotePreviewFileId, setOwnQuotePreviewFileId] = useState<string | null>(null);
  const [ownQuotePreviewUrl, setOwnQuotePreviewUrl] = useState<string | null>(null);
  const [ownQuotePreviewLoading, setOwnQuotePreviewLoading] = useState(false);
  const [isFillingStandardFromParsed, setIsFillingStandardFromParsed] = useState(false);
  const [pricingBreakdown, setPricingBreakdown] = useState<Record<string, any> | null>(null);
  // Renamed to avoid potential duplicate identifier in CI build
  const [showMaterialAlerts, setShowMaterialAlerts] = useState(true);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [markupPercent, setMarkupPercent] = useState<number>(20);
  const [vatPercent, setVatPercent] = useState<number>(20);
  const [markupDelivery, setMarkupDelivery] = useState<boolean>(false);
  const [amalgamateDelivery, setAmalgamateDelivery] = useState<boolean>(true);
  const [clientDeliveryCharge, setClientDeliveryCharge] = useState<number>(0);
  const [clientInstallationCharge, setClientInstallationCharge] = useState<number>(0);
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
  const [show3dModal, setShow3dModal] = useState(false);
  const [modalProductOptionId, setModalProductOptionId] = useState<string | null>(null);

  // (Removed duplicate recent material cost fetch + basic alert derivation)

  const questionnaireAnswers = useMemo(() => {
    if (!lead?.custom) return {};
    return { ...(lead.custom as Record<string, any>) };
  }, [lead]);

  const currency = quote?.currency ?? "GBP";
  const tenantName = quote?.tenant?.name ?? null;
  const quoteStatus = quote?.status ?? null;
  const proposalPdfUrl = (quote?.meta as any)?.proposalPdfUrl ?? quote?.proposalPdfUrl ?? null;

  const [proposalPreviewHtml, setProposalPreviewHtml] = useState<string | null>(null);
  const [proposalPreviewLoading, setProposalPreviewLoading] = useState(false);
  const [proposalPreviewError, setProposalPreviewError] = useState<string | null>(null);
  const [proposalPreviewRevision, setProposalPreviewRevision] = useState(0);
  const proposalPreviewAbortRef = useRef<AbortController | null>(null);

  const [proposalEditorOpen, setProposalEditorOpen] = useState(false);

  const refreshProposalPreview = useCallback(async () => {
    if (!quoteId) return;
    proposalPreviewAbortRef.current?.abort();
    const controller = new AbortController();
    proposalPreviewAbortRef.current = controller;

    setProposalPreviewLoading(true);
    setProposalPreviewError(null);
    try {
      const resp = await apiFetch<{ ok: boolean; html?: string }>(
        `/quotes/${encodeURIComponent(quoteId)}/proposal/html`,
        { method: "GET", signal: controller.signal },
      );
      setProposalPreviewHtml(typeof resp?.html === "string" ? resp.html : "");
    } catch (err: any) {
      // Ignore aborts during rapid updates
      if (String(err?.name || "") === "AbortError") return;
      setProposalPreviewError(err?.message || "Failed to load proposal preview");
    } finally {
      setProposalPreviewLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    if (activeTab !== "proposal") return;
    if (!quoteId) return;

    const t = setTimeout(() => {
      void refreshProposalPreview();
    }, 500);

    return () => clearTimeout(t);
  }, [activeTab, quoteId, lineRevision, proposalPreviewRevision, refreshProposalPreview]);

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

  const quoteDraft = useMemo(() => {
    if (!quote) return null;
    return normalizeQuoteDraft({ quote, lead, tenantSettings });
  }, [quote, lead, tenantSettings]);

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

  // Handle 3D modal from query parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const show3d = params.get('show3d');
      if (show3d) {
        setModalProductOptionId(show3d);
        setShow3dModal(true);
        // Clean up the URL
        window.history.replaceState({}, '', `/quotes/${quoteId}`);
      }
    }
  }, [quoteId]);

  // Load saved product configuration from quote metadata
  useEffect(() => {
    if (!quote?.meta) return;
    const meta = quote.meta as any;
    
    // Restore selected product option
    if (meta.selectedProductOptionId) {
      console.log('[Product Config] Restoring selectedProductOptionId:', meta.selectedProductOptionId);
      setSelectedProductOptionId(meta.selectedProductOptionId);
    }
    
    // Restore configuration answers
    if (meta.configAnswers && typeof meta.configAnswers === 'object') {
      console.log('[Product Config] Restoring configAnswers:', meta.configAnswers);
      setConfigAnswers(meta.configAnswers);
    }
  }, [quote?.meta]); // Only run when quote.meta changes, not on every render

  // Save product configuration to quote metadata only
  const saveProductConfiguration = useCallback(async () => {
    if (!quoteId || !quote) {
      toast({ title: "Error", description: "Quote not loaded", variant: "destructive" });
      return;
    }
    try {
      const nextMeta = {
        ...((quote?.meta as any) || {}),
        selectedProductOptionId,
        configAnswers,
      };
      console.log('[Product Config] Saving to quote.meta:', { selectedProductOptionId, configAnswers });
      await apiFetch(`/quotes/${encodeURIComponent(quoteId)}`, {
        method: "PATCH",
        json: { meta: nextMeta },
      });
      await mutateQuote();
      toast({ title: "Configuration saved" });
    } catch (err: any) {
      console.error("Save product configuration error:", err);
      toast({ title: "Save failed", description: err?.message || "Unknown error", variant: "destructive" });
    }
  }, [quoteId, quote, selectedProductOptionId, configAnswers, mutateQuote, toast]);
  const reestimateNeeded = estimate && estimatedLineRevision !== null && estimatedLineRevision !== lineRevision;

  const runSupplierProcessing = useCallback(async () => {
    if (!quoteId) return;

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
    if (!quoteId) return;
    if (isParsing) return;
    void runSupplierProcessing();
  }, [quoteId, isParsing, runSupplierProcessing]);

  const handlePreviewSupplierFile = useCallback(
    async (fileId: string) => {
      if (!quoteId || !fileId) return;
      setSupplierPreviewFileId(fileId);
      setSupplierPreviewLoading(true);
      setSupplierPreviewUrl(null);
      try {
        const signed = await apiFetch<{ url: string }>(
          `/quotes/${encodeURIComponent(quoteId)}/files/${encodeURIComponent(fileId)}/signed`,
        );
        setSupplierPreviewUrl(signed?.url || null);
      } catch (err: any) {
        toast({ title: "Unable to preview file", description: err?.message || "Missing file", variant: "destructive" });
        setSupplierPreviewUrl(null);
      } finally {
        setSupplierPreviewLoading(false);
      }
    },
    [quoteId, toast],
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

        toast({ title: "Files uploaded", description: `${files.length} file(s) uploaded. Processing…` });

        const updatedQuote = await mutateQuote();
        const latest = ((updatedQuote?.supplierFiles ?? quote?.supplierFiles) ?? [])
          .filter((f: any) => f?.kind === "SUPPLIER_QUOTE")
          .slice()
          .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime())[0];
        if (latest?.id) {
          setSupplierPreviewFileId(latest.id);
          void handlePreviewSupplierFile(latest.id);
        }

        await runSupplierProcessing();
        await mutateLines();
      } catch (err: any) {
        setError(err?.message || "Upload failed");
        toast({ title: "Upload failed", description: err?.message || "Unable to upload supplier file", variant: "destructive" });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsUploading(false);
      }
    },
    [quoteId, mutateQuote, mutateLines, quote?.supplierFiles, runSupplierProcessing, toast, handlePreviewSupplierFile],
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
        // Upload files as OWN_QUOTE files (kept separate from supplier uploads)
        for (const file of Array.from(files)) {
          await uploadOwnQuotePdf(quoteId, file);
        }
        
        // Parse without transformations
        const res = await apiFetch<{ lines?: ParsedLineDto[]; count?: number }>(`/quotes/${encodeURIComponent(quoteId)}/process-supplier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileKind: "OWN_QUOTE",
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
        
        const updatedQuote = await mutateQuote();
        await mutateLines();

        // Keep user on this tab so they can preview + review parsed lines.
        // Default preview to the most recently uploaded file.
        const latest = ((updatedQuote?.ownQuoteFiles ?? quote?.ownQuoteFiles) ?? [])
          .filter((f: any) => f?.kind === "OWN_QUOTE")
          .slice()
          .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime())[0];
        if (latest?.id) {
          setOwnQuotePreviewFileId(latest.id);
        }
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
    [quoteId, mutateQuote, mutateLines, quote?.ownQuoteFiles, toast],
  );

  const handlePreviewOwnQuoteFile = useCallback(
    async (fileId: string) => {
      if (!quoteId || !fileId) return;
      setOwnQuotePreviewFileId(fileId);
      setOwnQuotePreviewLoading(true);
      setOwnQuotePreviewUrl(null);
      try {
        const signed = await apiFetch<{ url: string }>(
          `/quotes/${encodeURIComponent(quoteId)}/files/${encodeURIComponent(fileId)}/signed`,
        );
        setOwnQuotePreviewUrl(signed?.url || null);
      } catch (err: any) {
        toast({ title: "Unable to preview file", description: err?.message || "Missing file", variant: "destructive" });
        setOwnQuotePreviewUrl(null);
      } finally {
        setOwnQuotePreviewLoading(false);
      }
    },
    [quoteId, toast],
  );

  const handleFillStandardFromParsed = useCallback(async () => {
    if (!quoteId) return;
    setIsFillingStandardFromParsed(true);
    setError(null);
    try {
      const res = await fillLineStandardFromParsed(quoteId);
      toast({
        title: "Filled product details",
        description: `Updated ${res.updated} line item(s) with details found in the quote.`,
      });
      await mutateLines();
    } catch (err: any) {
      setError(err?.message || "Failed to fill product details");
      toast({
        title: "Fill failed",
        description: err?.message || "Unable to fill product line item details",
        variant: "destructive",
      });
    } finally {
      setIsFillingStandardFromParsed(false);
    }
  }, [quoteId, mutateLines, toast]);

  

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
    // Open a placeholder window synchronously to avoid popup blockers.
    // (Browsers often block window.open after awaiting network requests.)
    const popup = window.open("about:blank", "_blank");
    try {
      await apiFetch(`/quotes/${encodeURIComponent(quoteId)}/render-pdf`, { method: "POST" });
      const signed = await apiFetch<{ url: string }>(`/quotes/${encodeURIComponent(quoteId)}/proposal/signed`);
      if (signed?.url) {
        if (popup) popup.location.href = signed.url;
        else window.open(signed.url, "_blank");
      } else {
        if (popup) popup.close();
      }
      toast({ title: "Proposal generated", description: "Proposal PDF opened in a new tab." });
    } catch (err: any) {
      if (popup) popup.close();
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
      if (response?.estimatedTotal == null) {
        toast({
          title: "Estimate ready",
          description: "Prediction received, but it wasn't applied to line items.",
        });
      } else {
        toast({ title: "Estimate ready", description: `Predicted total ${formatCurrency(response.estimatedTotal, currency)}.` });
      }
      await Promise.all([mutateQuote(), mutateLines()]);
    } catch (err: any) {
      const status = Number(err?.status || err?.response?.status || 0) || null;
      const details = err?.details;
      const apiMessage =
        (details && typeof details === "object" && (details.message || details.error)) ||
        (typeof details === "string" ? details : null);
      const message = apiMessage || err?.message || "Unable to generate ML estimate";
      setError(message);
      toast({
        title: status === 422 ? "More information needed" : "Estimate failed",
        description: message,
        variant: "destructive",
      });
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
      const response = await generateMlEstimate(quoteId);
      setEstimate(response);
      setLastEstimateAt(new Date().toISOString());
      setEstimatedLineRevision(lineRevision);
      setPricingBreakdown(null);
      if (response?.estimatedTotal == null) {
        toast({
          title: "Estimate ready",
          description: "Prediction received, but it wasn't applied to line items.",
        });
      } else {
        toast({ title: "Estimate ready", description: `Predicted total ${formatCurrency(response.estimatedTotal, currency)}.` });
      }

      await Promise.all([mutateQuote(), mutateLines()]);
    } catch (err: any) {
      const status = Number(err?.status || err?.response?.status || 0) || null;
      const details = err?.details;
      const apiMessage =
        (details && typeof details === "object" && (details.message || details.error)) ||
        (typeof details === "string" ? details : null);
      const message = apiMessage || err?.message || "Unable to generate ML estimate";
      toast({
        title: status === 422 ? "More information needed" : "Estimate failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsEstimating(false);
      setIsPricing(false);
    }
  }, [quoteId, mutateQuote, mutateLines, toast, currency, lineRevision, leadId]);

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

  const ensureProposalPdfUrl = useCallback(async (): Promise<string | null> => {
    if (!quoteId) return null;
    const existing = (quote?.meta as any)?.proposalPdfUrl ?? quote?.proposalPdfUrl ?? null;
    if (existing) return existing;

    setIsGeneratingPdf(true);
    try {
      await apiFetch(`/quotes/${encodeURIComponent(quoteId)}/render-pdf`, { method: "POST" });
      await mutateQuote();
      const next = (quote?.meta as any)?.proposalPdfUrl ?? quote?.proposalPdfUrl ?? null;
      return next;
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [quoteId, quote?.meta, quote?.proposalPdfUrl, mutateQuote]);

  const handleSavePdfFromProposalTab = useCallback(async () => {
    // Open immediately to keep the user gesture and avoid popup blockers.
    const popup = window.open("about:blank", "_blank");
    const url = await ensureProposalPdfUrl();
    if (url) {
      if (popup) popup.location.href = url;
      else window.open(url, "_blank");
    } else {
      if (popup) popup.close();
    }
  }, [ensureProposalPdfUrl]);

  const handleSaveProposalBasics = useCallback(async () => {
    if (!quoteId) return;
    setIsSavingProposalBasics(true);
    try {
      const existingMeta = ((quote as any)?.meta || {}) as any;
      const existingSpecs = (existingMeta?.specifications || {}) as any;

      const nextSpecs = {
        ...existingSpecs,
        timber: proposalSpecsDraft.timber,
        finish: proposalSpecsDraft.finish,
        glazing: proposalSpecsDraft.glazing,
        fittings: proposalSpecsDraft.fittings,
        ventilation: proposalSpecsDraft.ventilation,
      };

      await apiFetch(`/quotes/${encodeURIComponent(quoteId)}`, {
        method: "PATCH",
        json: {
          meta: {
            scopeDescription: proposalScopeDraft,
            specifications: nextSpecs,
          },
        },
      });

      await mutateQuote();
      setProposalPreviewRevision((r) => r + 1);
      toast({ title: "Saved", description: "Scope and project details updated for the proposal." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Unable to save proposal details", variant: "destructive" });
    } finally {
      setIsSavingProposalBasics(false);
    }
  }, [quoteId, mutateQuote, proposalScopeDraft, proposalSpecsDraft, toast, quote]);

  // Initialize proposal basics drafts from quote.meta (only once per quote load).
  useEffect(() => {
    if (!quoteId) {
      proposalBasicsInitRef.current = false;
      return;
    }
    if (!quote || proposalBasicsInitRef.current) return;
    const metaAny: any = (quote as any)?.meta || {};
    const specsAny: any = metaAny?.specifications || {};
    setProposalScopeDraft(typeof metaAny?.scopeDescription === "string" ? metaAny.scopeDescription : "");
    setProposalSpecsDraft({
      timber: typeof specsAny?.timber === "string" ? specsAny.timber : "",
      finish: typeof specsAny?.finish === "string" ? specsAny.finish : "",
      glazing: typeof specsAny?.glazing === "string" ? specsAny.glazing : "",
      fittings: typeof specsAny?.fittings === "string" ? specsAny.fittings : "",
      ventilation: typeof specsAny?.ventilation === "string" ? specsAny.ventilation : "",
    });
    proposalBasicsInitRef.current = true;
  }, [quoteId, quote]);

  const handlePrintPdfFromProposalTab = useCallback(async () => {
    const url = await ensureProposalPdfUrl();
    if (!url) return;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
    };
  }, [ensureProposalPdfUrl]);

  const handleEmailPdfFromProposalTab = useCallback(async () => {
    const url = await ensureProposalPdfUrl();
    if (!url) {
      toast({
        title: "No PDF to send",
        description: "Generate a PDF first",
        variant: "destructive",
      });
      return;
    }
    await handleEmailToClient();
  }, [ensureProposalPdfUrl, handleEmailToClient, toast]);

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

  const handleDeleteUploadedFile = useCallback(
    async (fileId: string) => {
      if (!fileId) return;
      setError(null);
      try {
        await apiFetch(`/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
        toast({ title: "File deleted", description: "The uploaded file was removed." });

        if (ownQuotePreviewFileId === fileId) {
          setOwnQuotePreviewFileId(null);
          setOwnQuotePreviewUrl(null);
          setOwnQuotePreviewLoading(false);
        }

        if (supplierPreviewFileId === fileId) {
          setSupplierPreviewFileId(null);
          setSupplierPreviewUrl(null);
          setSupplierPreviewLoading(false);
        }

        await mutateQuote();
      } catch (err: any) {
        setError(err?.message || "Delete failed");
        toast({ title: "Delete failed", description: err?.message || "Unable to delete file", variant: "destructive" });
      }
    },
    [mutateQuote, ownQuotePreviewFileId, supplierPreviewFileId, toast],
  );

  // Handle product type selection from type selector modal
  const handleTypeSelection = useCallback((selection: { category: string; type: string; option: string }) => {
    // Product type selection now happens within UnifiedQuoteLineItems component
    // This closes the modals after selection
    setShowTypeSelector(false);
    setShowAiSearch(false);
    toast({
      title: "Product type selected",
      description: `${selection.category === "doors" ? "Door" : "Window"} - ${selection.type} - ${selection.option}`,
    });
  }, [toast]);

  // Handle AI search for product type
  const handleAiSearch = useCallback(async () => {
    if (!aiSearchQuery.trim()) return;

    setAiSearching(true);
    try {
      const response = await apiFetch<
        | { category: string; type: string; option: string; confidence: number; clarifications?: never }
        | { clarifications: Array<{ question: string; options: Array<{ label: string; category: string; type: string; option: string; hint?: string }> }>; message?: string }
      >("/ml/search-product-type", {
        method: "POST",
        json: { description: aiSearchQuery },
      });

      if ((response as any).clarifications) {
        const data = response as { clarifications: Array<{ question: string; options: any[] }>; message?: string };
        setAiClarifications(data.clarifications);
        if (data.message) {
          toast({ title: "Need more detail", description: data.message });
        }
        return;
      }

      const match = response as { category: string; type: string; option: string; confidence: number };
      if (match.category && match.type && match.option) {
        handleTypeSelection({
          category: match.category,
          type: match.type,
          option: match.option,
        });
        toast({
          title: "Product type found",
          description: `Matched: ${match.category} - ${match.type} - ${match.option}`,
        });
      } else {
        toast({
          title: "No match found",
          description: "Try refining your description",
        });
      }
    } catch (err: any) {
      toast({
        title: "AI search failed",
        description: err?.message || "Unable to search product types",
        variant: "destructive",
      });
    } finally {
      setAiSearching(false);
    }
  }, [aiSearchQuery, handleTypeSelection, toast]);

  // Handle clarification selection from AI
  const handleClarificationSelect = useCallback((opt: { label: string; category: string; type: string; option: string }) => {
    handleTypeSelection({
      category: opt.category,
      type: opt.type,
      option: opt.option,
    });
  }, [handleTypeSelection]);

  // Callbacks for UnifiedQuoteLineItems component
  const handleAddLineItem = useCallback(
    async (newLine: {
      description: string;
      qty: number | null;
      unitPrice?: number | null;
      sellUnit?: number | null;
      sellTotal?: number | null;
      widthMm?: number | null;
      heightMm?: number | null;
      timber?: string;
      finish?: string;
      ironmongery?: string;
      glazing?: string;
      productOptionId?: string | null;
    }) => {
      if (!quoteId) return;
      try {
        // Create the line item first
        const created = await createQuoteLine(quoteId, {
          description: newLine.description,
          quantity: newLine.qty ?? 1,
          unitPrice: newLine.unitPrice ?? 0,
        });
        
        // Update with lineStandard/meta if provided
        const lineId = (created as any)?.line?.id;
        if (lineId) {
          const lineStandard: any = {};
          if (newLine.widthMm != null) lineStandard.widthMm = newLine.widthMm;
          if (newLine.heightMm != null) lineStandard.heightMm = newLine.heightMm;
          if (typeof newLine.timber === 'string') lineStandard.timber = newLine.timber;
          if (typeof newLine.finish === 'string') lineStandard.finish = newLine.finish;
          if (typeof newLine.ironmongery === 'string') lineStandard.ironmongery = newLine.ironmongery;
          if (typeof newLine.glazing === 'string') lineStandard.glazing = newLine.glazing;
          if (typeof newLine.productOptionId === 'string' && newLine.productOptionId) {
            lineStandard.productOptionId = newLine.productOptionId;
          }

          const qty = Math.max(1, Number(newLine.qty ?? 1));
          const meta: any = {};
          const sellUnit = newLine.sellUnit != null ? Number(newLine.sellUnit) : null;
          const sellTotal = newLine.sellTotal != null ? Number(newLine.sellTotal) : null;
          if (sellUnit != null && Number.isFinite(sellUnit)) {
            meta.sellUnitGBP = sellUnit;
            meta.sellTotalGBP = sellTotal != null && Number.isFinite(sellTotal) ? sellTotal : sellUnit * qty;
            meta.pricingMethod = 'manual';
            meta.isOverridden = true;
          } else if (sellTotal != null && Number.isFinite(sellTotal)) {
            meta.sellTotalGBP = sellTotal;
            meta.sellUnitGBP = sellTotal / qty;
            meta.pricingMethod = 'manual';
            meta.isOverridden = true;
          }

          const payload: any = {};
          if (Object.keys(lineStandard).length > 0) payload.lineStandard = lineStandard;
          if (Object.keys(meta).length > 0) payload.meta = meta;
          if (Object.keys(payload).length > 0) {
            await updateQuoteLine(quoteId, lineId, payload);
          }
        }
        
        toast({ title: "Line item added", description: "New line item created successfully" });
        await mutateLines();
      } catch (err: any) {
        toast({
          title: "Failed to add line item",
          description: err?.message || "Unable to create line item",
          variant: "destructive",
        });
      }
    },
    [quoteId, mutateLines, toast],
  );

  const handleUpdateLineItem = useCallback(
    async (lineId: string, updates: any) => {
      if (!quoteId) return;
      try {
        // Transform flat updates back to nested lineStandard structure
        const lineStandardFields = ['widthMm', 'heightMm', 'timber', 'finish', 'ironmongery', 'glazing', 'productOptionId'];
        const lineStandard: any = {};
        const directUpdates: any = {};
        const meta: any = {};
        
        Object.entries(updates).forEach(([key, value]) => {
          if (lineStandardFields.includes(key)) {
            lineStandard[key] = value;
          } else if (key === 'sellUnit') {
            const n = value == null ? null : Number(value);
            if (n != null && Number.isFinite(n)) {
              meta.sellUnitGBP = n;
              const qty = Math.max(1, Number((updates as any)?.qty ?? 1));
              meta.sellTotalGBP = n * qty;
              meta.pricingMethod = 'manual';
              meta.isOverridden = true;
            }
          } else if (key === 'sellTotal') {
            const n = value == null ? null : Number(value);
            if (n != null && Number.isFinite(n)) {
              meta.sellTotalGBP = n;
              const qty = Math.max(1, Number((updates as any)?.qty ?? 1));
              meta.sellUnitGBP = qty > 0 ? n / qty : n;
              meta.pricingMethod = 'manual';
              meta.isOverridden = true;
            }
          } else {
            directUpdates[key] = value;
          }
        });
        
        // Prepare the update payload
        const payload: any = { ...directUpdates };
        if (Object.keys(lineStandard).length > 0) {
          payload.lineStandard = lineStandard;
        }
        if (Object.keys(meta).length > 0) {
          payload.meta = meta;
        }
        
        await updateQuoteLine(quoteId, lineId, payload);
        toast({ title: "Line item updated", description: "Changes saved successfully" });
        await mutateLines();
      } catch (err: any) {
        toast({
          title: "Failed to update line item",
          description: err?.message || "Unable to update line item",
          variant: "destructive",
        });
      }
    },
    [quoteId, mutateLines, toast],
  );

  const handleDeleteLineItem = useCallback(
    async (lineId: string) => {
      if (!quoteId) return;
      try {
        // Assuming there's a deleteQuoteLine API (if not, we'll need to add it)
        await apiFetch(`/quotes/${encodeURIComponent(quoteId)}/lines/${encodeURIComponent(lineId)}`, {
          method: "DELETE",
        });
        toast({ title: "Line item deleted", description: "Line item removed successfully" });
        await mutateLines();
      } catch (err: any) {
        toast({
          title: "Failed to delete line item",
          description: err?.message || "Unable to delete line item",
          variant: "destructive",
        });
      }
    },
    [quoteId, mutateLines, toast],
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
            <TabsList className="grid w-full grid-cols-8 h-auto">
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
              <TabsTrigger value="proposal" className="flex flex-col gap-1 py-3">
                <Save className="h-4 w-4" />
                <span className="text-xs">Proposal</span>
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

                {quoteDraft && (
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div>
                        <div className="text-xs uppercase text-muted-foreground">Quote #</div>
                        <div className="font-medium">{quoteDraft.quoteNumber}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-muted-foreground">Issue date</div>
                        <div className="font-medium">{quoteDraft.issueDate}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-muted-foreground">Expiry date</div>
                        <div className="font-medium">{quoteDraft.expiryDate}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-muted-foreground">Currency</div>
                        <div className="font-medium">{quoteDraft.currency}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-muted-foreground">VAT</div>
                        <div className="font-medium">
                          {quoteDraft.showVat ? `${Math.round(quoteDraft.vatRate * 100)}%` : "VAT excluded"}
                        </div>
                      </div>
                    </div>

                    {quoteDraft.warnings.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {quoteDraft.warnings.map((warning) => (
                          <div key={warning}>⚠️ {warning}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
                  <h2 className="text-2xl font-semibold text-foreground mb-2">Product Configuration & Line Items</h2>
                  <p className="text-sm text-muted-foreground">
                    Select a product type, upload photos for AI analysis, and manage all your line items with integrated preview
                  </p>
                </div>

                {/* Product line items - Unified component with integrated actions */}
                <div className="space-y-3">
                  <div className="text-sm font-medium text-foreground">Line Items</div>
                  <UnifiedQuoteLineItems
                    lines={lines.map(line => ({
                      id: line.id,
                      description: line.description || '',
                      qty: line.qty || 1,
                      widthMm: line.lineStandard?.widthMm,
                      heightMm: line.lineStandard?.heightMm,
                      timber: line.lineStandard?.timber,
                      finish: line.lineStandard?.finish,
                      ironmongery: line.lineStandard?.ironmongery,
                      glazing: line.lineStandard?.glazing,
                      productOptionId: line.lineStandard?.productOptionId,
                      unitPrice: line.unitPrice ?? undefined,
                      sellUnit: line.sellUnit ?? undefined,
                      sellTotal: line.sellTotal ?? undefined,
                    }))}
                    productCategories={productCategories}
                    currency={currency}
                    onAddLine={handleAddLineItem}
                    onUpdateLine={handleUpdateLineItem}
                    onDeleteLine={handleDeleteLineItem}
                    onPreview3d={async (_lineId, productOptionId) => {
                      if (productOptionId) {
                        setModalProductOptionId(productOptionId);
                        setShow3dModal(true);
                      }
                    }}
                  />
                </div>


                {/* Type Selector Modal */}
                {showTypeSelector && (
                  <TypeSelectorModal
                    isOpen={true}
                    onClose={() => setShowTypeSelector(false)}
                    onSelect={(selection) =>
                      handleTypeSelection(selection)
                    }
                  />
                )}

                {/* AI Product Type Search Modal */}
                {showAiSearch && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">AI Product Type Search</h3>
                        <button
                          onClick={() => {
                            setShowAiSearch(false);
                            setAiClarifications(null);
                          }}
                          className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                        >
                          ×
                        </button>
                      </div>
                      {!aiClarifications && (
                          <>
                            <p className="text-sm text-slate-600">
                              Describe the product in plain English, or paste an AI-generated description from a photo.
                            </p>
                            <textarea
                              value={aiSearchQuery}
                              onChange={(e) => setAiSearchQuery(e.target.value)}
                              placeholder="e.g., 'Double casement window with georgian bars' or paste AI description..."
                              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              rows={4}
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                onClick={() => setShowAiSearch(false)}
                                disabled={aiSearching}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleAiSearch}
                                disabled={!aiSearchQuery.trim() || aiSearching}
                              >
                                {aiSearching ? (
                                  <>
                                    <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                                    Searching...
                                  </>
                                ) : (
                                  <>
                                    <Wand2 className="h-4 w-4 mr-2" />
                                    Search
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setShowAiSearch(false);
                                  setTimeout(() => setShowTypeSelector(true), 50);
                                }}
                                disabled={aiSearching}
                              >
                                Browse Manually
                              </Button>
                            </div>
                          </>
                        )}

                        {aiClarifications && (
                          <div className="space-y-4">
                            <p className="text-sm text-slate-600">
                              We need a bit more detail to pick the right product. Choose an option below.
                            </p>
                            {aiClarifications.map((clarification, idx) => (
                              <div key={idx} className="space-y-2">
                                <div className="font-medium text-slate-900">{clarification.question}</div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  {clarification.options.map((opt) => (
                                    <button
                                      key={`${opt.type}-${opt.option}-${opt.label}`}
                                      onClick={() => handleClarificationSelect(opt)}
                                      className="border rounded-lg p-3 text-left hover:border-blue-500 hover:bg-blue-50 transition"
                                    >
                                      <div className="font-semibold text-slate-900">{opt.label}</div>
                                      {opt.hint && <div className="text-xs text-slate-600 mt-1">{opt.hint}</div>}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {/* 3D Preview Modal */}
                {show3dModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden h-[90vh] flex flex-col min-h-0">
                      {show3dModal && (
                        <AIComponentConfigurator
                          tenantId={quote?.tenantId || 'preview'}
                          lineItem={{
                            configuredProduct: {
                              productType: (() => {
                                // Find the selected product option and extract its category/type/option
                                for (const cat of productCategories) {
                                  if (!cat.types) continue;
                                  for (const type of cat.types) {
                                    if (!type.options) continue;
                                    const opt = type.options.find((o: any) => o.id === modalProductOptionId);
                                    if (opt) {
                                      return {
                                        category: cat.value || 'doors',
                                        type: type.value || 'standard',
                                        option: opt.value || 'E01',
                                      };
                                    }
                                  }
                                }
                                return { category: 'doors', type: 'standard', option: 'E01' };
                              })(),
                            },
                            lineStandard: {
                              widthMm: 914,
                              heightMm: 2032,
                            },
                            meta: {
                              depthMm: 45,
                            },
                            description: 'Product Preview',
                          }}
                          description="Product Preview"
                          onClose={() => {
                            setShow3dModal(false);
                            setModalProductOptionId(null);
                          }}
                          height="calc(95vh - 40px)"
                        />
                      )}
                    </div>
                  </div>
                )}
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

                {/* Upload area (mirrors Own Quote UX) */}
                <div className="space-y-4">
                  <div 
                    className="text-center py-8 border-2 border-dashed border-muted rounded-xl hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="h-12 w-12 mx-auto mb-4 opacity-40" />
                    <h3 className="text-lg font-medium mb-2">Upload supplier quote</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Click to browse or drag PDF files here
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={(e) => {
                        e.stopPropagation();
                        openUploadDialog();
                      }}
                      disabled={isUploading || isParsing}
                    >
                      {isUploading || isParsing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          {isUploading ? "Uploading..." : "Parsing..."}
                        </>
                      ) : (
                        <>
                          <FileUp className="h-4 w-4 mr-2" />
                          Select PDF
                        </>
                      )}
                    </Button>
                  </div>

                  {(quote?.supplierFiles ?? []).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Uploaded files:</h4>
                      {(quote?.supplierFiles ?? []).map((file) => (
                        <div
                          key={file.id}
                          className={`flex items-center gap-2 text-sm p-2 rounded border hover:bg-muted/30 ${
                            supplierPreviewFileId === file.id ? "border-primary" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="flex flex-1 min-w-0 items-center gap-2 text-left"
                            onClick={() => void handlePreviewSupplierFile(file.id)}
                          >
                            <FileText className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{file.name}</span>
                            <span className="text-muted-foreground flex-shrink-0">
                              ({(file.sizeBytes ? file.sizeBytes / 1024 : 0).toFixed(1)} KB)
                            </span>
                            <span className="ml-auto text-xs text-muted-foreground">Preview</span>
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteUploadedFile(file.id);
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            aria-label="Delete file"
                            title="Delete"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(quote?.supplierFiles ?? []).length > 0 && (
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground">Pricing controls</div>
                          <div className="text-xs text-muted-foreground">
                            Set markup, VAT, delivery, and optional installation when converting.
                          </div>
                        </div>
                        <Button
                          type="button"
                          className="gap-2"
                          onClick={() => {
                            if (!selectedFileId) {
                              const firstId = (quote?.supplierFiles ?? [])[0]?.id ?? null;
                              setSelectedFileId(firstId);
                            }
                            setProcessDialogOpen(true);
                          }}
                          disabled={isProcessingSupplier}
                        >
                          Convert to client quote…
                        </Button>
                      </div>
                    </div>
                  )}

                  {(supplierPreviewLoading || supplierPreviewUrl) && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Preview</h4>
                      {supplierPreviewLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading preview...
                        </div>
                      ) : supplierPreviewUrl ? (
                        <iframe
                          title="Uploaded supplier quote preview"
                          src={supplierPreviewUrl}
                          className="w-full rounded-xl border"
                          style={{ height: "70vh" }}
                        />
                      ) : null}
                    </div>
                  )}
                </div>

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
                    ref={ownQuoteFileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => handleUploadOwnQuote(e.target.files)}
                    className="hidden"
                  />
                  
                  <div 
                    className="text-center py-8 border-2 border-dashed border-muted rounded-xl hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => ownQuoteFileInputRef.current?.click()}
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
                        ownQuoteFileInputRef.current?.click();
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
                  
                  {quote?.ownQuoteFiles && quote.ownQuoteFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Uploaded files:</h4>
                      {quote.ownQuoteFiles.map((file) => (
                        <div
                          key={file.id}
                          className={`flex items-center gap-2 text-sm p-2 rounded border hover:bg-muted/30 ${
                            ownQuotePreviewFileId === file.id ? "border-primary" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="flex flex-1 min-w-0 items-center gap-2 text-left"
                            onClick={() => void handlePreviewOwnQuoteFile(file.id)}
                          >
                            <FileText className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{file.name}</span>
                            <span className="text-muted-foreground flex-shrink-0">
                              ({(file.sizeBytes ? file.sizeBytes / 1024 : 0).toFixed(1)} KB)
                            </span>
                            <span className="ml-auto text-xs text-muted-foreground">Preview</span>
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteUploadedFile(file.id);
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            aria-label="Delete file"
                            title="Delete"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(ownQuotePreviewLoading || ownQuotePreviewUrl) && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Preview</h4>
                      {ownQuotePreviewLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading preview...
                        </div>
                      ) : ownQuotePreviewUrl ? (
                        <iframe
                          title="Uploaded quote preview"
                          src={ownQuotePreviewUrl}
                          className="w-full rounded-xl border"
                          style={{ height: "70vh" }}
                        />
                      ) : null}
                    </div>
                  )}

                  {lines && lines.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-medium">Parsed line items</h4>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={isFillingStandardFromParsed}
                            onClick={() => void handleFillStandardFromParsed()}
                          >
                            {isFillingStandardFromParsed ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Filling...
                              </>
                            ) : (
                              <>
                                <Wand2 className="h-4 w-4" />
                                Fill product details from parsed quote
                              </>
                            )}
                          </Button>
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => setActiveTab("quote-lines")}>
                            <FileText className="h-4 w-4" />
                            View all
                          </Button>
                        </div>
                      </div>

                      <div className="max-h-[360px] overflow-auto rounded-xl border">
                        <div className="divide-y">
                          {lines.map((ln) => (
                            <div key={ln.id} className="p-3 text-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div className="font-medium text-foreground">{ln.description || "Item"}</div>
                                <div className="text-right text-muted-foreground whitespace-nowrap">
                                  {typeof ln.qty === "number" ? `x${ln.qty}` : ""}
                                </div>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                Unit: {typeof ln.unitPrice === "number" ? formatCurrency(ln.unitPrice, currency) : "—"}
                                {ln.lineStandard?.widthMm && ln.lineStandard?.heightMm
                                  ? ` · ${ln.lineStandard.widthMm}×${ln.lineStandard.heightMm}mm`
                                  : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use “Fill product details…” to populate dimensions/spec fields on your line items so the system can learn from your uploaded quote.
                      </p>
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
                    tenantId={quote?.tenantId || ''}
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

            <TabsContent value="proposal" className="space-y-6">
              {quoteId ? (
                <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-3"
                      onClick={() => setProposalBasicsOpen((v) => !v)}
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium">Scope & project details (proposal)</div>
                        <div className="text-xs text-muted-foreground">Shown at the top of the proposal; edit here if AI didn’t fill it.</div>
                      </div>
                      {proposalBasicsOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {proposalBasicsOpen ? (
                      <div className="mt-4 space-y-4">
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Scope (1–3 sentences)</div>
                          <Textarea
                            value={proposalScopeDraft}
                            onChange={(e) => setProposalScopeDraft(e.target.value)}
                            placeholder="Describe the overall scope shown in the proposal…"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Timber</div>
                            <Input value={proposalSpecsDraft.timber} onChange={(e) => setProposalSpecsDraft((p) => ({ ...p, timber: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Finish</div>
                            <Input value={proposalSpecsDraft.finish} onChange={(e) => setProposalSpecsDraft((p) => ({ ...p, finish: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Glazing</div>
                            <Input value={proposalSpecsDraft.glazing} onChange={(e) => setProposalSpecsDraft((p) => ({ ...p, glazing: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Hardware / fittings</div>
                            <Input value={proposalSpecsDraft.fittings} onChange={(e) => setProposalSpecsDraft((p) => ({ ...p, fittings: e.target.value }))} />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <div className="text-xs font-medium text-muted-foreground">Ventilation</div>
                            <Input value={proposalSpecsDraft.ventilation} onChange={(e) => setProposalSpecsDraft((p) => ({ ...p, ventilation: e.target.value }))} />
                          </div>
                        </div>

                        <div className="flex items-center justify-end">
                          <Button onClick={handleSaveProposalBasics} disabled={isSavingProposalBasics} className="gap-2">
                            {isSavingProposalBasics ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Save proposal details
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-semibold text-foreground mb-2">Live preview</h2>
                      <p className="text-sm text-muted-foreground">
                        Updates automatically as quote lines change.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleSavePdfFromProposalTab}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={isGeneratingPdf}
                      >
                        {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save PDF
                      </Button>
                      <Button
                        onClick={handlePrintPdfFromProposalTab}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={isGeneratingPdf}
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </Button>
                      <Button
                        onClick={handleEmailPdfFromProposalTab}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={isSendingEmail || isGeneratingPdf}
                      >
                        {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        Email PDF
                      </Button>

                      <Button variant="outline" size="sm" asChild>
                        <Link href="/settings#business-details">Edit business details</Link>
                      </Button>
                      <div className="text-sm text-muted-foreground">
                        {proposalPreviewLoading ? "Updating…" : null}
                      </div>
                    </div>
                  </div>

                  {proposalPreviewError ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                      {proposalPreviewError}
                    </div>
                  ) : null}

                  <div className="relative w-full" style={{ height: "700px" }}>
                    <iframe
                      title="Proposal live preview"
                      className="w-full h-full rounded-lg border bg-background"
                      srcDoc={proposalPreviewHtml || ""}
                    />
                  </div>
                </div>
              ) : null}

              {quoteId ? (
                <div className="rounded-2xl border bg-card p-4 shadow-sm">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3"
                    onClick={() => setProposalEditorOpen((v) => !v)}
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium">Proposal editor</div>
                      <div className="text-xs text-muted-foreground">Expand to edit scope and upload template images</div>
                    </div>
                    {proposalEditorOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {proposalEditorOpen ? (
                    <div className="mt-4">
                      <ProposalEditor
                        quoteId={quoteId}
                        initialMeta={((quote?.meta as any) || null) as any}
                        onSaved={async () => {
                          await mutateQuote();
                          setProposalPreviewRevision((r) => r + 1);
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
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

            <div>
              <label className="block text-sm font-medium">Client installation charge</label>
              <input
                type="number"
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={clientInstallationCharge}
                onChange={(e) => setClientInstallationCharge(Number(e.target.value) || 0)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Added as a separate line item (ex VAT) when converting.
              </p>
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
                      const baseClientQuote = (resp as any).client_quote as any;
                      const installGBP = clientInstallationCharge > 0 ? clientInstallationCharge : 0;
                      const vatRate = Math.max(0, Number(vatPercent) || 0) / 100;

                      const clientQuote = installGBP > 0
                        ? {
                            ...baseClientQuote,
                            lines: [
                              ...(Array.isArray(baseClientQuote?.lines) ? baseClientQuote.lines : []),
                              {
                                description: "Installation",
                                qty: 1,
                                unit_price: 0,
                                total: 0,
                                unit_price_marked_up: installGBP,
                                total_marked_up: installGBP,
                              },
                            ],
                            subtotal: Number(baseClientQuote?.subtotal ?? 0) + installGBP,
                            vat_amount: Number(baseClientQuote?.vat_amount ?? 0) + (installGBP * vatRate),
                            grand_total: Number(baseClientQuote?.grand_total ?? 0) + (installGBP * (1 + vatRate)),
                          }
                        : baseClientQuote;

                      const gt = Number(clientQuote?.grand_total ?? 0);
                      
                      // Step 2: Auto-save the lines
                      toast({
                        title: "Converting to client quote",
                        description: `Saving lines and generating proposal...`,
                      });
                      
                      await saveClientQuoteLines(quoteId, clientQuote, { replace: true });
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
