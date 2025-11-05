"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { apiFetch, API_BASE } from "@/lib/api";
import Gauge from "@/app/components/Gauge";
import { useCurrentUser } from "@/lib/use-current-user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { FollowupPlanner } from "@/app/components/FollowupPlanner";
// Using a native range input instead of a custom Slider to avoid extra deps

const MODULES = [
  { id: "lead_classifier", label: "Lead Classifier" },
  { id: "quote_builder", label: "Quotation Builder" },
  { id: "estimator", label: "Estimator" },
  { id: "sales_assistant", label: "Sales Assistant" },
] as const;

type Insight = {
  id: string;
  module: string;
  inputSummary?: string | null;
  decision?: string | null;
  confidence?: number | null;
  userFeedback?: any;
  createdAt: string;
};

type ParamRow = {
  id: string;
  module: string;
  key: string;
  value: any;
  reason?: string | null;
  createdAt: string;
};

type InsightsResponse = {
  ok: boolean;
  items: Insight[];
  params: ParamRow[];
};

type FollowupLearningResponse = {
  optIn: boolean;
  summary?: string;
  sampleSize?: number;
  variants?: {
    variant: string;
    sampleSize: number;
    replyRate?: number;
    conversionRate?: number;
    avgDelayDays?: number | null;
    successScore?: number;
  }[];
  call?: {
    sampleSize?: number;
    avgDelayDays?: number | null;
    conversionRate?: number | null;
  };
  lastUpdatedISO?: string | null;
};

type EmailTrainingResponse = {
  quotesFound?: number;
  trainingRecords?: number;
  message?: string;
  parsed_ok?: number;
  training_records_saved?: number;
  failed?: number;
  received_items?: number;
  avg_estimated_total?: number;
  preview_quotes?: Array<{
    subject: string;
    date_sent: string;
    attachment_name: string;
    confidence: number;
    project_type?: string;
    quoted_price?: number;
    area_m2?: number;
    materials_grade?: string;
  }>;
};

function formatDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s));
  } catch {
    return s;
  }
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  const pct = value * 100;
  if (pct >= 10) return `${Math.round(pct)}%`;
  return `${Math.round(pct * 10) / 10}%`;
}

function formatDaysLabel(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  const days = Number(value);
  if (!Number.isFinite(days)) return "—";
  if (days <= 0) return "Same day";
  if (days < 1) {
    const hrs = Math.max(1, Math.round(days * 24));
    return `${hrs} hr${hrs === 1 ? "" : "s"}`;
  }
  const rounded = Math.round(days * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    const whole = Math.max(1, Math.round(rounded));
    return `${whole} day${whole === 1 ? "" : "s"}`;
  }
  return `${rounded} days`;
}

export default function AiTrainingPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [mlHealth, setMlHealth] = useState<{ ok: boolean; target?: string } | null>(null);
  const [moduleId, setModuleId] = useState<typeof MODULES[number]["id"]>("lead_classifier");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [params, setParams] = useState<ParamRow[]>([]);
  const [threshold, setThreshold] = useState<number>(0.6);
  const [saving, setSaving] = useState(false);
  const [openPreviewId, setOpenPreviewId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, { loading: boolean; data?: any; error?: string }>>({});
  const [limit, setLimit] = useState<number>(50);
  const [providerFilter, setProviderFilter] = useState<"all" | "gmail" | "ms365" | "other">("all");
  const [decisionFilter, setDecisionFilter] = useState<"all" | "accepted" | "rejected" | "other">("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  // Historic supplier quotes ingestion
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [files, setFiles] = useState<Array<{ id: string; name: string; uploadedAt?: string; mimeType?: string; sizeBytes?: number | null }>>([]);
  const [fileSel, setFileSel] = useState<Record<string, boolean>>({});
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [followupLearning, setFollowupLearning] = useState<FollowupLearningResponse | null>(null);
  const [followupLoading, setFollowupLoading] = useState(false);
  const [followupError, setFollowupError] = useState<string | null>(null);
  const [updatingFollowupOptIn, setUpdatingFollowupOptIn] = useState(false);
  const [followupTab, setFollowupTab] = useState<"overview" | "planner">("overview");
  // Email training state
  const [emailTraining, setEmailTraining] = useState<{
    status: 'idle' | 'running' | 'completed' | 'error';
    progress?: number;
    message?: string;
    quotesFound?: number;
    trainingRecords?: number;
    previewQuotes?: Array<{
      subject: string;
      date_sent: string;
      attachment_name: string;
      confidence: number;
      project_type?: string;
      quoted_price?: number;
      area_m2?: number;
      materials_grade?: string;
    }>;
  }>({ status: 'idle' });
  const [emailProvider, setEmailProvider] = useState<'gmail' | 'ms365'>('gmail');
  const [daysBack, setDaysBack] = useState(30);

  // Manual quote upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<Array<{
    file: File;
    id: string;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    progress?: number;
    result?: any;
    error?: string;
    quoteType?: 'supplier' | 'client';
  }>>([]);
  const [dragCounter, setDragCounter] = useState(0);
  const [selectedQuoteType, setSelectedQuoteType] = useState<'supplier' | 'client'>('supplier');

  const fetchFollowupLearning = useCallback(async () => {
    setFollowupLoading(true);
    setFollowupError(null);
    try {
      const data = await apiFetch<FollowupLearningResponse>("/ai/followup/learning");
      setFollowupLearning(data);
    } catch (e: any) {
      setFollowupError(e?.message || "Failed to load follow-up learning");
    } finally {
      setFollowupLoading(false);
    }
  }, []);

  const isEA = !!user?.isEarlyAdopter;

  // ML health indicator
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const h = await apiFetch<{ ok: boolean; target?: string }>("/ml/health");
        if (!cancel) setMlHealth(h);
      } catch {
        if (!cancel) setMlHealth({ ok: false });
      }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    void fetchFollowupLearning();
  }, [fetchFollowupLearning]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await apiFetch<InsightsResponse>(`/ml/insights?module=${moduleId}&limit=${limit}`);
        if (!cancel) {
          setInsights(data.items || []);
          setParams(data.params || []);
          // Pull last threshold if present
          const p = (data.params || []).find((r) => r.key === "lead.threshold" || r.key.endsWith(".threshold"));
          if (p && typeof p.value === "number") setThreshold(p.value);
        }
      } catch (e: any) {
        if (!cancel) setError(e?.message || "Failed to load training data");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [moduleId, limit]);

  // Load recent supplier quote files
  useEffect(() => {
    let cancel = false;
    setFilesLoading(true);
    setFilesError(null);
    (async () => {
      try {
        const resp = await apiFetch<{ ok: boolean; items: any[] }>(`/files?kind=SUPPLIER_QUOTE&limit=50`);
        if (!cancel) setFiles((resp.items || []).map((x) => ({ id: x.id, name: x.name, uploadedAt: x.uploadedAt, mimeType: x.mimeType, sizeBytes: x.sizeBytes })));
      } catch (e: any) {
        if (!cancel) setFilesError(e?.message || "Failed to load uploaded files");
      } finally {
        if (!cancel) setFilesLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const avgConf = useMemo(() => {
    const xs = insights.map((i) => i.confidence).filter((x): x is number => typeof x === "number");
    if (!xs.length) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }, [insights]);

  const filteredInsights = useMemo(() => {
    const getProvider = (i: Insight) => {
      if (!i.inputSummary || !i.inputSummary.startsWith("email:")) return "other" as const;
      const p = i.inputSummary.split(":")[1];
      return (p === "gmail" || p === "ms365") ? (p as "gmail" | "ms365") : "other";
    };
    return insights.filter((i) => {
      const prov = getProvider(i);
      const dec = (i.decision || "").toLowerCase();
      const provOk = providerFilter === "all" || prov === providerFilter;
      const decOk =
        decisionFilter === "all" ||
        (decisionFilter === "accepted" && dec === "accepted") ||
        (decisionFilter === "rejected" && dec === "rejected") ||
        (decisionFilter === "other" && dec !== "accepted" && dec !== "rejected");
      return provOk && decOk;
    });
  }, [insights, providerFilter, decisionFilter]);

  const summary = useMemo(() => {
    const s = { total: filteredInsights.length, accepted: 0, rejected: 0 };
    for (const i of filteredInsights) {
      const d = (i.decision || "").toLowerCase();
      if (d === "accepted") s.accepted++;
      else if (d === "rejected") s.rejected++;
    }
    return s;
  }, [filteredInsights]);

  const trendData = useMemo(() => {
    // Aggregate accepted/rejected counts by date (YYYY-MM-DD)
    const byDate = new Map<string, { date: string; accepted: number; rejected: number }>();
    for (const i of filteredInsights) {
      const d = i.createdAt ? new Date(i.createdAt) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      const key = d.toISOString().slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, { date: key, accepted: 0, rejected: 0 });
      const row = byDate.get(key)!;
      const dec = (i.decision || "").toLowerCase();
      if (dec === "accepted") row.accepted += 1;
      else if (dec === "rejected") row.rejected += 1;
    }
    // Sort ascending by date
    return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [filteredInsights]);

  const followupHasData = (followupLearning?.sampleSize ?? 0) > 0;

  const followupTopVariant = useMemo(() => {
    if (!followupLearning?.variants || followupLearning.variants.length === 0) return null;
    const ordered = [...followupLearning.variants].sort(
      (a, b) => (b.successScore ?? 0) - (a.successScore ?? 0),
    );
    return ordered[0];
  }, [followupLearning?.variants]);

  function parseEmailRef(inputSummary?: string | null): { provider: string; messageId: string } | null {
    if (!inputSummary || !inputSummary.startsWith("email:")) return null;
    const parts = inputSummary.split(":");
    const provider = parts[1];
    const messageId = parts.slice(2).join(":");
    return { provider, messageId };
  }

  function toCsvValue(v: any): string {
    if (v == null) return "";
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function toggleFile(id: string) {
    setFileSel((s) => ({ ...s, [id]: !s[id] }));
  }

  function selectAllFiles() {
    const next: Record<string, boolean> = { ...fileSel };
    for (const f of files) next[f.id] = true;
    setFileSel(next);
  }

  function clearFiles() {
    setFileSel({});
  }

  async function toggleFollowupOptIn(next: boolean) {
    setUpdatingFollowupOptIn(true);
    try {
      await apiFetch("/tenant/settings", {
        method: "PATCH",
        json: { aiFollowupLearning: { crossTenantOptIn: next } },
      });
      setFollowupLearning((prev) => (prev ? { ...prev, optIn: next } : { optIn: next }));
      toast({
        title: next ? "Sharing enabled" : "Sharing paused",
        description: next
          ? "Your follow-ups contribute to the network playbook."
          : "We’ll keep future follow-ups private.",
        duration: 2600,
      });
      await fetchFollowupLearning();
    } catch (e: any) {
      toast({ title: "Couldn’t update sharing", description: e?.message || "", variant: "destructive" });
    } finally {
      setUpdatingFollowupOptIn(false);
    }
  }

  async function trainOnSelectedFiles() {
    const ids = Object.entries(fileSel).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/internal/ml/save-train-from-uploaded`, { method: "POST", json: { uploadedFileIds: ids } });
      toast({ title: "Training kicked", description: `${ids.length} file(s) sent to ML`, duration: 2500 });
      clearFiles();
    } catch (e: any) {
      setError(e?.message || "Could not send files to train");
    } finally {
      setSaving(false);
    }
  }

  async function createDraftQuoteAndOpen() {
    setCreatingQuote(true);
    try {
      const q = await apiFetch<any>("/quotes", { method: "POST", json: { title: `Draft quote ${new Date().toLocaleString()}` } });
      if (q?.id) {
        window.location.href = `/quotes/${encodeURIComponent(q.id)}`;
      }
    } catch (e) {
      // silently ignore; error box below handles general API errors
    } finally {
      setCreatingQuote(false);
    }
  }

  function exportCsv() {
    const headers = [
      "timestamp",
      "module",
      "provider",
      "messageId",
      "decision",
      "confidence",
      "feedbackThumbs",
      "inputSummary",
    ];
    const rows = filteredInsights.map((i) => {
      const ref = parseEmailRef(i.inputSummary);
      const provider = ref?.provider || "";
      const messageId = ref?.messageId || "";
      const thumbs = typeof i.userFeedback?.thumbs === "boolean" ? i.userFeedback.thumbs : "";
      return [
        i.createdAt,
        i.module,
        provider,
        messageId,
        i.decision || "",
        typeof i.confidence === "number" ? i.confidence.toFixed(3) : "",
        thumbs,
        i.inputSummary || "",
      ].map(toCsvValue).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `ai-training-${moduleId}-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function toggleSelectOne(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function selectAllCurrent() {
    const next: Record<string, boolean> = { ...selected };
    for (const i of filteredInsights) next[i.id] = true;
    setSelected(next);
  }

  function clearSelection() {
    setSelected({});
  }

  async function retrainWithSelection() {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return;
    setSaving(true);
    setError(null);
    try {
  await apiFetch(`/ml/insights/model/retrain`, { method: "POST", json: { module: moduleId, insightIds: ids } });
      toast({ title: "Retrain queued", description: `${ids.length} examples selected`, duration: 2500 });
      clearSelection();
    } catch (e: any) {
      setError(e?.message || "Could not retrain with selection");
    } finally {
      setSaving(false);
    }
  }

  async function saveThreshold() {
    setSaving(true);
    setError(null);
    try {
  await apiFetch(`/ml/insights/params/set`, { method: "POST", json: { module: moduleId, key: "lead.threshold", value: threshold } });
    } catch (e: any) {
      setError(e?.message || "Could not save parameter");
    } finally {
      setSaving(false);
    }
  }

  async function retrain() {
    setSaving(true);
    setError(null);
    try {
  await apiFetch(`/ml/insights/model/retrain`, { method: "POST", json: { module: moduleId } });
    } catch (e: any) {
      setError(e?.message || "Could not trigger retrain");
    } finally {
      setSaving(false);
    }
  }

  async function startEmailTraining() {
    setEmailTraining({ status: 'running', progress: 0, message: 'Starting email training...' });
    setError(null);
    
    try {
      // Start the email training workflow
      const response = await apiFetch<EmailTrainingResponse>(`/ml/start-email-training`, {
        method: 'POST',
        json: {
          emailProvider: emailProvider,
          daysBack: daysBack,
          credentials: {} // Will use stored credentials
        }
      });
      
      setEmailTraining({
        status: 'completed',
        progress: 100,
        message: 'Email training completed successfully',
        quotesFound: response.quotesFound || 0,
        trainingRecords: response.trainingRecords || 0
      });
      
      toast({
        title: "Email Training Complete",
        description: `Found ${response.quotesFound || 0} quotes, created ${response.trainingRecords || 0} training records`,
        duration: 5000
      });
      
      // Refresh insights to show new training data
      window.location.reload();
      
    } catch (e: any) {
      setEmailTraining({
        status: 'error',
        message: e?.message || 'Email training failed'
      });
      setError(e?.message || 'Email training failed');
    }
  }

  async function previewEmailQuotes() {
    setEmailTraining({ status: 'running', progress: 0, message: 'Scanning emails for quotes...' });
    setError(null);
    
    try {
      const response = await apiFetch<EmailTrainingResponse>(`/ml/preview-email-quotes`, {
        method: 'POST',
        json: {
          emailProvider: emailProvider,
          daysBack: daysBack
        }
      });
      
      setEmailTraining({
        status: 'completed',
        progress: 100,
        message: `Preview complete: Found ${response.quotesFound || 0} potential client quotes`,
        quotesFound: response.quotesFound || 0,
        previewQuotes: response.preview_quotes || []
      });
      
      toast({
        title: "Email Preview Complete",
        description: `Found ${response.quotesFound || 0} potential client quotes in the last ${daysBack} days`,
        duration: 4000
      });
      
    } catch (e: any) {
      setEmailTraining({
        status: 'error',
        message: e?.message || 'Email preview failed'
      });
      setError(e?.message || 'Email preview failed');
    }
  }

  async function trainSupplierQuotes() {
    setEmailTraining({ status: 'running', progress: 0, message: 'Training on uploaded supplier quotes...' });
    setError(null);
    
    try {
      const response = await apiFetch<EmailTrainingResponse>(`/ml/train-supplier-quotes`, {
        method: 'POST',
        json: {}
      });
      
      setEmailTraining({
        status: 'completed',
        progress: 100,
        message: `Training complete: ${response.parsed_ok || 0} quotes processed`,
        trainingRecords: response.training_records_saved || 0,
        quotesFound: response.parsed_ok || 0
      });
      
      toast({
        title: "Supplier Training Complete",
        description: `Processed ${response.parsed_ok || 0} supplier quotes, created ${response.training_records_saved || 0} training records`,
        duration: 5000
      });
      
      // Refresh insights to show updated model
      window.location.reload();
      
    } catch (e: any) {
      setEmailTraining({
        status: 'error',
        message: e?.message || 'Supplier training failed'
      });
      setError(e?.message || 'Supplier training failed');
    }
  }

  async function trainClientQuotes() {
    setEmailTraining({ status: 'running', progress: 0, message: 'Training ML models with client quotes...' });
    setError(null);
    
    try {
      const response = await apiFetch<EmailTrainingResponse>(`/ml/train-client-quotes`, {
        method: 'POST',
        json: {}
      });
      
      setEmailTraining({
        status: 'completed',
        progress: 100,
        message: 'ML model training completed',
        trainingRecords: response.trainingRecords || 0
      });
      
      toast({
        title: "ML Training Complete",
        description: `Trained models with ${response.trainingRecords || 0} client quote records`,
        duration: 5000
      });
      
      // Refresh insights to show updated model
      window.location.reload();
      
    } catch (e: any) {
      setEmailTraining({
        status: 'error',
        message: e?.message || 'ML training failed'
      });
      setError(e?.message || 'ML training failed');
    }
  }

  // Manual quote upload functions
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter === 1) {
      setIsDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const files = Array.from(e.dataTransfer.files);
    addFilesToQueue(files);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFilesToQueue(files);
    }
  }

  function addFilesToQueue(files: File[]) {
    const pdfFiles = files.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length !== files.length) {
      toast({
        title: "Invalid files detected",
        description: "Only PDF files are supported for quote training",
        variant: "destructive"
      });
    }

    const newUploads = pdfFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending' as const,
      quoteType: selectedQuoteType
    }));

    setUploadQueue(prev => [...prev, ...newUploads]);

    // Auto-start upload for each file
    newUploads.forEach(upload => {
      setTimeout(() => uploadQuoteFile(upload), 100);
    });
  }

  async function uploadQuoteFile(upload: typeof uploadQueue[0]) {
    setUploadQueue(prev => prev.map(u => 
      u.id === upload.id ? { ...u, status: 'uploading', progress: 0 } : u
    ));

    try {
      // Convert file to base64
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix (e.g., "data:application/pdf;base64,")
          const base64 = result.split(',')[1] || result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(upload.file);
      });
      
      // Force correct ML service URL for testing
      const ML_URL = 'https://new-ml-zo9l.onrender.com';
      console.log('Using ML_URL:', ML_URL); // Debug log
      
      const response = await fetch(`${ML_URL}/upload-quote-training`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: upload.file.name,
          base64: base64Content,
          quoteType: upload.quoteType || 'supplier',
          tenantId: user?.id || 'default-tenant'
        })
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      setUploadQueue(prev => prev.map(u => 
        u.id === upload.id ? { 
          ...u, 
          status: 'completed', 
          progress: 100, 
          result 
        } : u
      ));

      toast({
        title: "Quote uploaded successfully",
        description: `${upload.file.name} processed with ${(result.confidence * 100).toFixed(0)}% confidence`,
        duration: 3000
      });

    } catch (error: any) {
      setUploadQueue(prev => prev.map(u => 
        u.id === upload.id ? { 
          ...u, 
          status: 'error', 
          error: error.message 
        } : u
      ));

      toast({
        title: "Upload failed",
        description: `Failed to process ${upload.file.name}: ${error.message}`,
        variant: "destructive"
      });
    }
  }

  function removeFromQueue(id: string) {
    setUploadQueue(prev => prev.filter(u => u.id !== id));
  }

  function clearCompletedUploads() {
    setUploadQueue(prev => prev.filter(u => u.status !== 'completed'));
  }

  async function reset() {
    if (!confirm("Reset model parameters and cached adapters for this module?")) return;
    setSaving(true);
    setError(null);
    try {
  await apiFetch(`/ml/insights/model/reset`, { method: "POST", json: { module: moduleId } });
    } catch (e: any) {
      setError(e?.message || "Could not reset model");
    } finally {
      setSaving(false);
    }
  }

  async function sendFeedback(i: Insight, ok: boolean) {
    setSaving(true);
    setError(null);
    try {
      const payload: any = { module: moduleId, insightId: i.id, correct: ok };
      // For lead classifier, also pass isLead flag
      if (moduleId === "lead_classifier") payload.isLead = ok;
  await apiFetch(`/ml/insights/feedback`, { method: "POST", json: payload });
      // Optimistic: mark userFeedback locally
      setInsights((prev) => prev.map((row) => (row.id === i.id ? { ...row, userFeedback: { ...(row.userFeedback || {}), thumbs: ok } } : row)));
      toast({ title: "Feedback saved", description: moduleId === "lead_classifier" ? "Recorded and linked to email ingest." : "Recorded for retraining.", duration: 2500 });
    } catch (e: any) {
      setError(e?.message || "Could not send feedback");
    } finally {
      setSaving(false);
    }
  }

  async function togglePreview(i: Insight) {
    if (!i.inputSummary || !i.inputSummary.startsWith("email:")) return;
    const id = i.id;
    const parts = i.inputSummary.split(":");
    const provider = parts[1];
    const messageId = parts.slice(2).join(":");
    const already = previews[id];

    if (openPreviewId === id) {
      setOpenPreviewId(null);
      return;
    }

    if (!already || (!already.data && !already.loading)) {
      setPreviews((p) => ({ ...p, [id]: { loading: true } }));
      try {
        const msg = await apiFetch<any>(`/${provider}/message/${encodeURIComponent(messageId)}`);
        setPreviews((p) => ({ ...p, [id]: { loading: false, data: msg } }));
      } catch (e: any) {
        setPreviews((p) => ({ ...p, [id]: { loading: false, error: e?.message || "Failed to load message" } }));
      }
    }
    setOpenPreviewId(id);
  }

  return (
    <div className="space-y-8">
      {/* Beautiful Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">🤖 AI Training Hub</h1>
              <p className="text-slate-600 max-w-2xl">Train your AI models with email quotes and manual examples to improve accuracy and prediction power.</p>
            </div>
            <div className="flex items-center gap-3">
              {mlHealth && (
                <Badge variant={mlHealth.ok ? "secondary" : "destructive"} className="text-sm px-3 py-1">
                  ML: {mlHealth.ok ? "🟢 Online" : "🔴 Offline"}
                </Badge>
              )}
              {avgConf != null && (
                <Badge variant="secondary" className="text-sm px-3 py-1">✨ Avg confidence: {(avgConf * 100).toFixed(0)}%</Badge>
              )}
            </div>
          </div>
        </div>
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200/30 to-purple-200/30 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-200/30 to-blue-200/30 rounded-full blur-xl"></div>
      </div>

      {/* Quote Training Sections - Most Important */}
      {isEA && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Email-Based Client Quote Training */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/50 shadow-sm">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-200/20 rounded-full blur-xl"></div>
            <div className="relative p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">📧 Email Quote Discovery</h3>
                  <p className="text-sm text-slate-600">Automatically find and learn from client quotes in your email history</p>
                </div>
                {mlHealth && (
                  <Badge variant={mlHealth.ok ? "secondary" : "destructive"} className="text-xs">
                    {mlHealth.ok ? "🟢 Ready" : "🔴 Offline"}
                  </Badge>
                )}
              </div>

              {/* Beautiful Training Status */}
              {emailTraining.status !== 'idle' && (
                <div className="mb-6 p-4 rounded-xl bg-white/70 backdrop-blur-sm border border-white/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        emailTraining.status === 'running' ? 'bg-blue-500 animate-pulse' :
                        emailTraining.status === 'completed' ? 'bg-green-500' :
                        emailTraining.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                      }`}></div>
                      <span className="text-sm font-medium text-slate-700">Training Status</span>
                    </div>
                    <Badge variant={
                      emailTraining.status === 'completed' ? 'default' :
                      emailTraining.status === 'error' ? 'destructive' : 'secondary'
                    } className="text-xs">
                      {emailTraining.status === 'running' ? '⚡ Processing' : 
                       emailTraining.status === 'completed' ? '✅ Complete' :
                       emailTraining.status === 'error' ? '❌ Failed' : emailTraining.status}
                    </Badge>
                  </div>
                  
                  {emailTraining.progress !== undefined && emailTraining.status === 'running' && (
                    <div className="w-full bg-slate-200 rounded-full h-2 mb-3 overflow-hidden">
                      <div 
                        className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out" 
                        style={{ width: `${emailTraining.progress}%` }}
                      ></div>
                    </div>
                  )}
                  
                  <p className="text-sm text-slate-700 font-medium">{emailTraining.message}</p>
                  
                  <div className="flex gap-4 mt-2 text-xs text-slate-600">
                    {emailTraining.quotesFound !== undefined && (
                      <span className="flex items-center gap-1">
                        📊 <strong>{emailTraining.quotesFound}</strong> quotes found
                      </span>
                    )}
                    {emailTraining.trainingRecords !== undefined && (
                      <span className="flex items-center gap-1">
                        🎯 <strong>{emailTraining.trainingRecords}</strong> training records
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Preview Quotes Display */}
              {emailTraining.previewQuotes && emailTraining.previewQuotes.length > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-white/70 backdrop-blur-sm border border-white/50">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">📋 Found Client Quotes</h4>
                  <div className="space-y-3">
                    {emailTraining.previewQuotes.map((quote, index) => (
                      <div key={index} className="p-3 rounded-lg border border-slate-200 bg-white/50">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium text-sm text-slate-900">{quote.subject}</div>
                            <div className="text-xs text-slate-600">{quote.attachment_name}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-600">{new Date(quote.date_sent).toLocaleDateString()}</div>
                            <div className="text-xs font-medium text-blue-600">{(quote.confidence * 100).toFixed(0)}% confidence</div>
                          </div>
                        </div>
                        {(quote.quoted_price || quote.project_type || quote.materials_grade) && (
                          <div className="flex gap-4 text-xs text-slate-600">
                            {quote.quoted_price && (
                              <span>💰 £{quote.quoted_price.toLocaleString()}</span>
                            )}
                            {quote.project_type && (
                              <span>🏗️ {quote.project_type}</span>
                            )}
                            {quote.materials_grade && (
                              <span>⭐ {quote.materials_grade}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Training Controls */}
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      📧 Email Provider
                    </label>
                    <select 
                      value={emailProvider} 
                      onChange={(e) => setEmailProvider(e.target.value as 'gmail' | 'ms365')}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      disabled={emailTraining.status === 'running'}
                    >
                      <option value="gmail">Gmail</option>
                      <option value="ms365">Microsoft 365</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      📅 Days to scan back
                    </label>
                    <input 
                      type="number" 
                      value={daysBack} 
                      onChange={(e) => setDaysBack(parseInt(e.target.value) || 30)}
                      min="1" 
                      max="365"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      disabled={emailTraining.status === 'running'}
                    />
                  </div>
                </div>

                {/* Button Actions Explanation */}
                <div className="bg-slate-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-slate-900 mb-2">AI Training Workflow</h4>
                  <div className="grid gap-2 text-sm text-slate-600">
                    <div><strong>👀 Preview Quotes:</strong> Scan your emails to find potential quotes without saving them</div>
                    <div><strong>🚀 Start Training:</strong> Extract and save quotes from emails to improve AI accuracy</div>
                    <div><strong>🎯 Train Models:</strong> Retrain the AI models using all saved quote data</div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <Button 
                    onClick={previewEmailQuotes}
                    disabled={emailTraining.status === 'running' || !mlHealth?.ok}
                    variant="outline"
                    className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    {emailTraining.status === 'running' ? '🔄 Processing...' : '👀 Preview Quotes'}
                  </Button>
                  
                  <Button 
                    onClick={startEmailTraining}
                    disabled={emailTraining.status === 'running' || !mlHealth?.ok}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {emailTraining.status === 'running' ? '⚡ Training...' : '🚀 Start Training'}
                  </Button>
                  
                  <Button 
                    onClick={trainClientQuotes}
                    disabled={emailTraining.status === 'running' || !mlHealth?.ok}
                    variant="secondary"
                    className="w-full"
                  >
                    {emailTraining.status === 'running' ? '🔄 Training...' : '🎯 Train Models'}
                  </Button>
                </div>

                <div className="p-3 rounded-lg bg-emerald-100/60 border border-emerald-200">
                  <p className="text-xs text-emerald-800">
                    <strong>💡 How it works:</strong> Scans your emails for client quotes, extracts pricing patterns and requirements, 
                    then trains ML models to better predict pricing and match supplier products to client needs.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Manual Quote Upload Training */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200/50 shadow-sm">
            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-200/20 rounded-full blur-xl"></div>
            <div className="relative p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">📄 Manual Quote Training</h3>
                  <p className="text-sm text-slate-600">Upload specific PDF quotes to train with targeted examples</p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  ✅ {uploadQueue.filter(u => u.status === 'completed').length} processed
                </Badge>
              </div>

              {/* Quote Type Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  📋 Quote Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedQuoteType('supplier')}
                    className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      selectedQuoteType === 'supplier'
                        ? 'bg-violet-100 border-violet-300 text-violet-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🏭 Supplier Quote
                  </button>
                  <button
                    onClick={() => setSelectedQuoteType('client')}
                    className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      selectedQuoteType === 'client'
                        ? 'bg-violet-100 border-violet-300 text-violet-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    👤 Client Quote
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedQuoteType === 'supplier' 
                    ? '📥 Quotes received from suppliers/contractors' 
                    : '📤 Quotes sent to your clients/customers'
                  }
                </p>
              </div>

              {/* Training Action Buttons */}
              {selectedQuoteType === 'supplier' && (
                <div className="mb-4 flex gap-2">
                  <Button
                    onClick={trainSupplierQuotes}
                    disabled={emailTraining.status === 'running' || !mlHealth?.ok}
                    className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700"
                  >
                    {emailTraining.status === 'running' ? (
                      <>⚡ Training...</>
                    ) : (
                      <>🚀 Train on All Uploaded Files</>
                    )}
                  </Button>
                </div>
              )}

              {/* Beautiful Drag and Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
                  isDragging 
                    ? 'border-violet-400 bg-violet-100/50 scale-[1.02]' 
                    : 'border-slate-300 bg-white/70 hover:border-violet-300 hover:bg-violet-50/30'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    isDragging ? 'bg-violet-200 scale-110' : 'bg-slate-200'
                  }`}>
                    {isDragging ? (
                      <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${isDragging ? 'text-violet-700' : 'text-slate-700'}`}>
                      {isDragging ? '📄 Drop PDF quotes here!' : '🎯 Drag PDF quotes here to train'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Or click to browse files • PDF only
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => document.getElementById('quote-file-input')?.click()}
                    disabled={!mlHealth?.ok}
                    className="border-violet-300 text-violet-700 hover:bg-violet-50"
                  >
                    📁 Browse Files
                  </Button>
                </div>
                
                <input
                  id="quote-file-input"
                  type="file"
                  multiple
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              {/* Upload Queue with Beautiful Design */}
              {uploadQueue.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      📋 Upload Queue 
                      <Badge variant="outline" className="text-xs">
                        {uploadQueue.length} file{uploadQueue.length === 1 ? '' : 's'}
                      </Badge>
                    </h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={clearCompletedUploads}
                      disabled={uploadQueue.filter(u => u.status === 'completed').length === 0}
                      className="text-xs"
                    >
                      🗑️ Clear Completed
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {uploadQueue.map((upload) => (
                      <div key={upload.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate flex items-center gap-2">
                            📄 {upload.file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            💾 {(upload.file.size / 1024 / 1024).toFixed(2)} MB • 
                            {upload.quoteType === 'supplier' ? '🏭' : '👤'} {upload.quoteType || 'supplier'} quote
                          </p>
                          {upload.result && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              ✅ Confidence: <strong>{(upload.result.confidence * 100).toFixed(0)}%</strong> • 
                              📊 {upload.result.quote_type} quote • 
                              🎯 {upload.result.training_records_saved} training record saved
                            </p>
                          )}
                          {upload.error && (
                            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                              ❌ Error: {upload.error}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            upload.status === 'completed' ? 'default' :
                            upload.status === 'error' ? 'destructive' :
                            upload.status === 'uploading' ? 'secondary' : 'outline'
                          } className="text-xs">
                            {upload.status === 'completed' ? '✅' :
                             upload.status === 'error' ? '❌' :
                             upload.status === 'uploading' ? '⚡' : '⏳'} {upload.status}
                          </Badge>
                          
                          {upload.status === 'uploading' && upload.progress !== undefined && (
                            <div className="w-16 bg-slate-200 rounded-full h-1.5">
                              <div 
                                className="bg-violet-600 h-1.5 rounded-full transition-all duration-300" 
                                style={{ width: `${upload.progress}%` }}
                              ></div>
                            </div>
                          )}
                          
                          <button 
                            onClick={() => removeFromQueue(upload.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                            title="Remove from queue"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 rounded-lg bg-violet-100/60 border border-violet-200">
                <p className="text-xs text-violet-800">
                  <strong>💡 Training tips:</strong> Upload a variety of quotes with different formats, pricing structures, 
                  and product types. The more diverse examples you provide, the better the model will become at parsing quotes accurately.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isEA && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-200 mx-auto mb-3 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-amber-800 mb-2">🚀 Early Access Required</h3>
          <p className="text-sm text-amber-700">AI Training is currently limited to early access users. Contact support to get access!</p>
        </div>
      )}

      {/* Module Selection */}
      <div className="flex flex-wrap gap-2">
        {MODULES.map((m) => (
          <Button key={m.id} size="sm" variant={moduleId === m.id ? "default" : "outline"} onClick={() => setModuleId(m.id)}>
            {m.label}
          </Button>
        ))}
      </div>
      {moduleId === "sales_assistant" && (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Quote follow-up learning</p>
            <p className="text-xs text-slate-500">High‑level progress and performance of the Sales Assistant.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2 hidden w-px self-stretch bg-slate-200 sm:block" />
            {/* Keep a simple toggle to show a playground, but default to overview visuals */}
            {followupLearning?.sampleSize != null ? (
              <Badge variant="secondary" className="text-xs">
                {(followupLearning.sampleSize ?? 0).toLocaleString()} emails analysed
              </Badge>
            ) : null}
            {followupLearning ? (
              <Badge variant={followupLearning.optIn ? "secondary" : "destructive"} className="text-xs">
                {followupLearning.optIn ? "Sharing insights" : "Sharing paused"}
              </Badge>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => void fetchFollowupLearning()} disabled={followupLoading}>
              {followupLoading ? "Refreshing…" : "Refresh"}
            </Button>
            {followupLearning ? (
              <Button
                size="sm"
                variant={followupLearning.optIn ? "outline" : "default"}
                onClick={() => toggleFollowupOptIn(!(followupLearning.optIn))}
                disabled={updatingFollowupOptIn}
              >
                {updatingFollowupOptIn
                  ? "Saving…"
                  : followupLearning.optIn
                  ? "Pause sharing"
                  : "Enable sharing"}
              </Button>
            ) : null}
          </div>
        </div>
        {followupError ? (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{followupError}</div>
        ) : null}
        {followupLoading && !followupHasData ? (
          <div className="mt-4 text-sm text-slate-500">Loading follow-up insights…</div>
        ) : null}
        {!followupLoading && !followupHasData ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
            Send your first follow-up from an opportunity to unlock cadence analytics.
          </div>
        ) : null}
        {followupLearning ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Dials */}
            <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white p-4">
              <Gauge
                value={Math.max(0, Math.min(1, (followupTopVariant?.replyRate ?? 0)))}
                label="Reply rate"
                caption={followupTopVariant ? `Variant ${followupTopVariant.variant}` : undefined}
                color="#10b981"
              />
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white p-4">
              <Gauge
                value={Math.max(0, Math.min(1, (followupTopVariant?.conversionRate ?? 0)))}
                label="Win rate"
                caption={followupTopVariant ? `Variant ${followupTopVariant.variant}` : undefined}
                color="#6366f1"
              />
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white p-4">
              <Gauge
                value={Math.max(0, Math.min(1, Math.min(1, (followupLearning.sampleSize ?? 0) / 1000)))}
                label="Samples analysed"
                caption={`${(followupLearning.sampleSize ?? 0).toLocaleString()} emails`}
                color="#0ea5e9"
              />
            </div>
          </div>
        ) : null}
        {/* Minimal planner toggle */}
        <div className="mt-4 hidden">
          <FollowupPlanner title="Follow-up planner (playground)" />
        </div>
      </section>
      )}

      {/* Module overview dials for non-sales modules */}
      {moduleId !== "sales_assistant" && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Training progress</p>
            {avgConf != null && (
              <Badge variant="secondary" className="text-xs">Avg confidence {(avgConf * 100).toFixed(0)}%</Badge>
            )}
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white p-4">
              <Gauge value={Math.max(0, Math.min(1, avgConf ?? 0))} label="Model confidence" color="#10b981" />
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white p-4">
              <Gauge value={Math.max(0, Math.min(1, Math.min(1, filteredInsights.length / 500)))} label="Recent samples" caption={`${filteredInsights.length} items`} color="#0ea5e9" />
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white p-4">
              <Gauge value={mlHealth?.ok ? 1 : 0} label="Service health" caption={mlHealth?.ok ? "Online" : "Offline"} color="#f59e0b" />
            </div>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Activity trend</p>
              <span className="text-xs text-slate-500">by day</span>
            </div>
            <div className="h-32 w-full">
              {trendData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="acceptedFill2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="rejectedFill2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} width={24} tick={{ fontSize: 10 }} />
                    <Tooltip wrapperClassName="!text-xs" />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="accepted" stroke="#10b981" fillOpacity={1} fill="url(#acceptedFill2)" />
                    <Area type="monotone" dataKey="rejected" stroke="#ef4444" fillOpacity={1} fill="url(#rejectedFill2)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>
      )}

      {!isEA && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          AI Training is limited to early access users for now.
        </div>
      )}

      {/* Hide low-level working details and ingestion UI to keep the page clean and visual */}
      {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    </div>
  );
}
