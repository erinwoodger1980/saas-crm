// web/src/app/leads/page.tsx
"use client";

import { useEffect, useMemo, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import LeadModal, { Lead } from "./LeadModal";
import CsvImportModal from "@/components/leads/CsvImportModal";
import { on } from "@/lib/events";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";
import { DeskSurface } from "@/components/DeskSurface";
import { useTenantBrand } from "@/lib/use-tenant-brand";

/* -------------------------------- Types -------------------------------- */

type LeadStatus =
  | "NEW_ENQUIRY"
  | "INFO_REQUESTED"
  | "DISQUALIFIED"
  | "REJECTED"
  | "READY_TO_QUOTE"
  | "QUOTE_SENT"
  | "WON"
  | "LOST";

type Grouped = Record<LeadStatus, Lead[]>;

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW_ENQUIRY: "New enquiry",
  INFO_REQUESTED: "Info requested",
  DISQUALIFIED: "Disqualified",
  REJECTED: "Rejected",
  READY_TO_QUOTE: "Ready to quote",
  QUOTE_SENT: "Quote sent",
  WON: "Won",
  LOST: "Lost",
};

// Intake-focused tabs
const ACTIVE_TABS: LeadStatus[] = [
  "NEW_ENQUIRY",
  "INFO_REQUESTED",
  "DISQUALIFIED",
  "REJECTED",
  "READY_TO_QUOTE",
];

/* -------------------------------- Email Upload Types -------------------------------- */

type EmailUpload = {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress?: number;
  result?: {
    leadId: string;
    contactName: string;
    email: string;
    subject: string;
    confidence: number;
  };
  error?: string;
};

/* -------------------------------- Page -------------------------------- */

function LeadsPageContent() {
  const empty: Grouped = {
    NEW_ENQUIRY: [],
    INFO_REQUESTED: [],
    DISQUALIFIED: [],
    REJECTED: [],
    READY_TO_QUOTE: [],
    QUOTE_SENT: [],
    WON: [],
    LOST: [],
  };

  const { shortName } = useTenantBrand();
  const searchParams = useSearchParams();

  const [grouped, setGrouped] = useState<Grouped>(empty);
  const [tab, setTab] = useState<LeadStatus>("NEW_ENQUIRY");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // modal
  const [open, setOpen] = useState(false);
  const [leadPreview, setLeadPreview] = useState<Lead | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const { toast } = useToast();

  // email upload state
  const [emailUploadQueue, setEmailUploadQueue] = useState<EmailUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const buildAuthHeaders = (): HeadersInit | undefined => {
    const ids = getAuthIdsFromJwt();
    if (!ids?.tenantId || !ids?.userId) return undefined;
    return { "x-tenant-id": ids.tenantId, "x-user-id": ids.userId };
  };

  // Handle URL parameters for direct lead access
  const openLeadById = useCallback(async (leadId: string) => {
    let found: Lead | null = null;
    (Object.keys(grouped) as LeadStatus[]).some((s) => {
      const hit = grouped[s].find((x) => x.id === leadId);
      if (hit) {
        found = hit;
        return true;
      }
      return false;
    });

    if (found) {
      openLead(found);
      return;
    }
    try {
      const l = await apiFetch<Lead>(`/leads/${leadId}`, {
        headers: buildAuthHeaders(),
      });
      if (l?.id) openLead(l);
    } catch {
      // ignore
    }
  }, [grouped]);

  useEffect(() => {
    const leadId = searchParams.get('leadId');
    const modal = searchParams.get('modal');
    if (leadId && modal === 'lead') openLeadById(leadId);
  }, [searchParams, openLeadById]);

  const refreshGrouped = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Grouped>("/leads/grouped", {
        headers: buildAuthHeaders(),
      });
      setGrouped(normaliseToNewStatuses(data));
      setError(null);
    } catch (e: any) {
      setError(`Failed to load: ${e?.message ?? "unknown"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await ensureDemoAuth();
      if (!ok) return;
      await refreshGrouped();
    })();
  }, [refreshGrouped]);

  // 🔗 Listen for "open-lead" from the My Tasks drawer
  useEffect(() => {
    return on("open-lead", ({ leadId }) => openLeadById(leadId));
  }, [openLeadById]);

  // periodic refresh + optional auto-import every 10 minutes
  useEffect(() => {
    const id = setInterval(async () => {
      const auto = localStorage.getItem("autoImportInbox") === "true";
      try {
        if (auto) {
          const headers = buildAuthHeaders();
          await Promise.allSettled([
            apiFetch("/gmail/import", {
              method: "POST",
              headers,
              json: { max: 10, q: "newer_than:30d" },
            }),
            apiFetch("/ms365/import", { method: "POST", headers, json: { max: 10 } }),
          ]);
        }
      } finally {
        await refreshGrouped();
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [refreshGrouped]);

  function openLead(l: Lead) {
    setLeadPreview(l);
    setOpen(true);
  }

  // Normalize server buckets to new statuses and de-dupe by id
  function normaliseToNewStatuses(g: any): Grouped {
    const out: Grouped = {
      NEW_ENQUIRY: [],
      INFO_REQUESTED: [],
      DISQUALIFIED: [],
      REJECTED: [],
      READY_TO_QUOTE: [],
      QUOTE_SENT: [],
      WON: [],
      LOST: [],
    };

    const mapLegacyToNew = (legacy: string | undefined): LeadStatus => {
      switch ((legacy || "").toUpperCase()) {
        case "NEW":
          return "NEW_ENQUIRY";
        case "CONTACTED":
          return "INFO_REQUESTED";
        case "QUALIFIED":
          return "READY_TO_QUOTE";
        case "DISQUALIFIED":
          return "DISQUALIFIED";
        case "NEW_ENQUIRY":
        case "INFO_REQUESTED":
        case "REJECTED":
        case "READY_TO_QUOTE":
        case "QUOTE_SENT":
        case "WON":
        case "LOST":
          return legacy as LeadStatus;
        default:
          return "NEW_ENQUIRY";
      }
    };

    const seen = new Set<string>();
    const insert = (l: any) => {
      if (!l?.id || seen.has(l.id)) return;
      seen.add(l.id);
      const s = mapLegacyToNew(l.status as string);

      const contactNameCandidate =
        typeof l.contactName === "string" && l.contactName.trim() !== ""
          ? l.contactName.trim()
          : typeof l.contact?.name === "string" && l.contact.name.trim() !== ""
            ? l.contact.name.trim()
            : undefined;

      const emailCandidate =
        typeof l.email === "string" && l.email.trim() !== ""
          ? l.email.trim()
          : typeof l.contact?.email === "string" && l.contact.email.trim() !== ""
            ? l.contact.email.trim()
            : undefined;

      const descriptionCandidate =
        typeof l.description === "string" && l.description.trim() !== ""
          ? l.description.trim()
          : typeof l.custom?.description === "string" && l.custom.description.trim() !== ""
            ? l.custom.description.trim()
            : typeof l.custom?.bodyText === "string" && l.custom.bodyText.trim() !== ""
              ? l.custom.bodyText.trim()
              : undefined;

      const normalized: Lead = {
        ...(l as Lead),
        id: l.id,
        status: s,
        contactName: contactNameCandidate ?? l.contactName ?? null,
        email: emailCandidate ?? l.email ?? null,
        custom: (l.custom ?? l.briefJson ?? null) as Lead["custom"],
        description: descriptionCandidate ?? null,
      };

      out[s].push(normalized);
    };

    (g?.NEW || []).forEach(insert);
    (g?.CONTACTED || []).forEach(insert);
    (g?.QUALIFIED || []).forEach(insert);
    (g?.DISQUALIFIED || []).forEach(insert);
    (Object.keys(STATUS_LABELS) as LeadStatus[]).forEach((s) => (g?.[s] || []).forEach(insert));

    return out;
  }

  // PATCH helper used by modal (we keep only “Reject” here)
  async function setRejected(leadId: string) {
    // optimistic update to REJECTED
    setGrouped((g) => {
      const next = structuredClone(g);
      (Object.keys(next) as LeadStatus[]).forEach((s) => {
        const i = next[s].findIndex((x) => x.id === leadId);
        if (i >= 0) {
          const current = next[s][i];
          const updated: Lead = { ...current, status: "REJECTED" };
          next[s].splice(i, 1);
          next.REJECTED.unshift(updated);
        }
      });
      return next;
    });
    try {
      await apiFetch(`/leads/${leadId}`, {
        method: "PATCH",
        headers: buildAuthHeaders(),
        json: { status: "REJECTED" },
      });
    } catch (e) {
      console.error("reject failed:", e);
      refreshGrouped();
    }
  }

  // Only show intake tabs
  const rows = useMemo(() => {
    const list = grouped[tab as LeadStatus] || [];
    const seen = new Set<string>();
    return list.filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [grouped, tab]);

  async function handleCreateLead() {
    const input = prompt("Enter lead name:");
    const contactName = input?.trim();
    if (!contactName) return;
    try {
      const lead = await apiFetch<any>("/leads", {
        method: "POST",
        headers: buildAuthHeaders(),
        json: { contactName, email: "", custom: { provider: "manual" } },
      });
      await refreshGrouped();
      if (lead?.id) {
        openLead({
          id: lead.id,
          contactName: lead.contactName ?? contactName,
          email: lead.email ?? "",
          status: (lead.status as LeadStatus) ?? "NEW_ENQUIRY",
          custom: lead.custom ?? { provider: "manual" },
          description:
            (typeof lead.description === "string" && lead.description.trim() !== ""
              ? lead.description.trim()
              : typeof lead.custom?.description === "string"
                ? lead.custom.description.trim()
                : null) ?? null,
        });
      }
      toast({
        title: "Lead created",
        description: `${lead?.contactName ?? contactName} added to your inbox.`,
      });
    } catch (e: any) {
      const rawMessage = typeof e?.message === "string" ? e.message : "Please try again.";
      const cleaned = rawMessage.replace(/\sfor\shttps?:\/\/\S+/, "").trim();
      toast({
        title: "Failed to create lead",
        description: cleaned || "Please try again.",
        variant: "destructive",
      });
    }
  }

  /* ------------------------------ Email Upload Functions ------------------------------ */

  function handleEmailDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    
    // Check if we have files being dragged
    if (e.dataTransfer.types.includes('Files')) {
      console.log('🎯 Email files detected in drag operation');
      setIsDragging(true);
    }
  }

  function handleEmailDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
      dragCounterRef.current = 0;
    }
  }

  function handleEmailDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // This is crucial for enabling drop
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleEmailDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    console.log('📧 Email drop detected, files:', e.dataTransfer.files.length);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      console.log('📧 Processing files:', files.map(f => f.name).join(', '));
      addEmailFilesToQueue(files);
    } else {
      console.log('⚠️ No files found in drop operation');
    }
  }

  function handleEmailFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addEmailFilesToQueue(files);
    }
  }

  function addEmailFilesToQueue(files: File[]) {
    // Filter for email-like files (.eml, .msg, .txt) and check MIME types
    const emailFiles = files.filter(file => {
      const name = file.name.toLowerCase();
      const type = file.type.toLowerCase();
      
      // Check file extensions
      const validExtensions = name.endsWith('.eml') || 
                             name.endsWith('.msg') || 
                             name.endsWith('.txt') ||
                             name.endsWith('.mbox');
      
      // Check MIME types
      const validMimeTypes = type === 'message/rfc822' || 
                            type === 'text/plain' ||
                            type === 'application/vnd.ms-outlook' ||
                            type === 'application/octet-stream' || // Often used for .eml files
                            type === '';  // Some email files don't have MIME type set
      
      return validExtensions || validMimeTypes;
    });
    
    if (emailFiles.length !== files.length) {
      const skipped = files.length - emailFiles.length;
      toast({
        title: `${skipped} file(s) skipped`,
        description: "Only email files (.eml, .msg, .txt, .mbox) are supported",
        variant: "destructive"
      });
    }

    if (emailFiles.length === 0) {
      toast({
        title: "No valid email files",
        description: "Please drop email files (.eml, .msg, .txt, .mbox)",
        variant: "destructive"
      });
      return;
    }

    const newUploads = emailFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending' as const
    }));

    setEmailUploadQueue(prev => [...prev, ...newUploads]);

    // Auto-start upload for each file
    newUploads.forEach(upload => {
      setTimeout(() => uploadEmailFile(upload), 100);
    });
  }

  async function uploadEmailFile(upload: EmailUpload) {
    setEmailUploadQueue(prev => prev.map(u => 
      u.id === upload.id ? { ...u, status: 'uploading', progress: 0 } : u
    ));

    try {
      // Convert file to base64
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix (e.g., "data:text/plain;base64,")
          const base64 = result.split(',')[1] || result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(upload.file);
      });
      
      const headers = buildAuthHeaders();
      
      // Call email parsing API to extract lead information
      const response = await apiFetch<{
        leadId: string;
        contactName: string;
        email: string;
        subject: string;
        confidence: number;
        bodyText?: string;
      }>('/leads/parse-email', {
        method: 'POST',
        headers,
        json: {
          filename: upload.file.name,
          mimeType: upload.file.type || 'text/plain',
          base64: base64Content,
          provider: 'manual'
        }
      });

      setEmailUploadQueue(prev => prev.map(u => 
        u.id === upload.id ? { 
          ...u, 
          status: 'completed', 
          progress: 100, 
          result: response
        } : u
      ));

      toast({
        title: "Email processed successfully",
        description: `Created lead for ${response.contactName} with ${(response.confidence * 100).toFixed(0)}% confidence`,
        duration: 4000
      });

      // Refresh the leads to show the new one
      await refreshGrouped();

    } catch (error: any) {
      setEmailUploadQueue(prev => prev.map(u => 
        u.id === upload.id ? { 
          ...u, 
          status: 'error', 
          error: error.message || 'Upload failed'
        } : u
      ));

      toast({
        title: "Email processing failed",
        description: `Failed to process ${upload.file.name}: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  }

  function removeEmailFromQueue(id: string) {
    setEmailUploadQueue(prev => prev.filter(u => u.id !== id));
  }

  function clearCompletedEmailUploads() {
    setEmailUploadQueue(prev => prev.filter(u => u.status !== 'completed'));
  }

  /* ------------------------------ Render ------------------------------ */

  return (
    <>
      <DeskSurface innerClassName="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-white/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-500 shadow-sm"
              title="Capture and triage enquiries with a little Joinery pixie dust. Opportunities carry the quote journey through to win."
            >
              <span aria-hidden="true">✨</span>
              Lead desk
              {shortName && <span className="hidden sm:inline text-slate-400">· {shortName}</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setCsvImportOpen(true)}
            >
              📊 Import CSV
            </Button>
            <Button
              variant="default"
              type="button"
              onClick={handleCreateLead}
            >
              New Lead
            </Button>
            <Button
              variant="ghost"
              className="rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              type="button"
              onClick={refreshGrouped}
            >
              Refresh
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {ACTIVE_TABS.map((s) => {
            const active = tab === s;
            return (
              <button
                  key={s}
                  onClick={() => setTab(s)}
                  className={`group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    active
                      ? "border-transparent bg-gradient-to-r from-sky-500 via-indigo-500 to-rose-500 text-white shadow-[0_14px_34px_-18px_rgba(37,99,235,0.6)]"
                      : "border-slate-200/70 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-white"
                  }`}
                  type="button"
                >
                  <span>{STATUS_LABELS[s]}</span>
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                      active
                        ? "bg-white/30 text-white"
                        : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                    }`}
                  >
                    {grouped[s].length}
                  </span>
                </button>
              );
            })}
        </div>

        <SectionCard
          title="Inbox"
          action={
            <span className="text-xs font-medium text-slate-500">
              {loading ? "Syncing…" : `${rows.length} in “${STATUS_LABELS[tab]}”`}
            </span>
          }
        >
          {error && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 shadow-sm">
              {error}
            </div>
          )}

          {loading ? (
            <RowsSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              title={`No leads in “${STATUS_LABELS[tab]}”.`}
              action={
                <Button
                  variant="outline"
                  onClick={refreshGrouped}
                  type="button"
                >
                  Refresh Inbox
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3">
              {rows.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onOpen={() => openLead(lead)}
                  onReject={() => setRejected(lead.id)}
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Email Upload Section - Only show on NEW_ENQUIRY tab */}
        {tab === "NEW_ENQUIRY" && (
          <SectionCard
            title="Manual Email Import"
            action={
              <span className="text-xs font-medium text-slate-500">
                {emailUploadQueue.filter(u => u.status === 'completed').length} processed
              </span>
            }
          >
            <div className="space-y-4">
              <div className="text-sm text-slate-600 mb-3">
                Missed an enquiry? Drag and drop email files here to create leads automatically.
              </div>
              
              {/* Drag and Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                  isDragging 
                    ? 'border-sky-400 bg-sky-50' 
                    : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
                }`}
                onDragEnter={handleEmailDragEnter}
                onDragLeave={handleEmailDragLeave}
                onDragOver={handleEmailDragOver}
                onDrop={handleEmailDrop}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isDragging ? 'bg-sky-100' : 'bg-slate-200'
                  }`}>
                    <svg className={`w-6 h-6 ${isDragging ? 'text-sky-600' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${isDragging ? 'text-sky-700' : 'text-slate-700'}`}>
                      {isDragging ? 'Drop email files here' : 'Drag email files here to create leads'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports .eml, .msg, .txt, and .mbox files
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => document.getElementById('email-file-input')?.click()}
                  >
                    Browse Files
                  </Button>
                </div>
                
                <input
                  id="email-file-input"
                  type="file"
                  multiple
                  accept=".eml,.msg,.txt,.mbox,message/rfc822,text/plain,application/vnd.ms-outlook,application/octet-stream"
                  onChange={handleEmailFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              {/* Upload Queue */}
              {emailUploadQueue.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-700">Processing Queue</h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={clearCompletedEmailUploads}
                      disabled={emailUploadQueue.filter(u => u.status === 'completed').length === 0}
                    >
                      Clear Completed
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {emailUploadQueue.map((upload) => (
                      <div key={upload.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-white">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {upload.file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(upload.file.size / 1024).toFixed(1)} KB
                          </p>
                          {upload.result && (
                            <p className="text-xs text-green-600 mt-1">
                              ✓ Created lead for {upload.result.contactName} ({(upload.result.confidence * 100).toFixed(0)}% confidence)
                            </p>
                          )}
                          {upload.error && (
                            <p className="text-xs text-red-600 mt-1">
                              ✗ {upload.error}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            upload.status === 'completed' ? 'bg-green-100 text-green-700' :
                            upload.status === 'error' ? 'bg-red-100 text-red-700' :
                            upload.status === 'uploading' ? 'bg-blue-100 text-blue-700' : 
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {upload.status === 'uploading' ? 'Processing...' : upload.status}
                          </span>
                          
                          {upload.status === 'uploading' && upload.progress !== undefined && (
                            <div className="w-16 bg-slate-200 rounded-full h-1.5">
                              <div 
                                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                                style={{ width: `${upload.progress}%` }}
                              ></div>
                            </div>
                          )}
                          
                          <button 
                            onClick={() => removeEmailFromQueue(upload.id)}
                            className="text-slate-400 hover:text-slate-600 p-1"
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

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-700">
                  <strong>How it works:</strong> Upload email files (.eml, .msg, .txt, .mbox) and the system will automatically extract contact information, 
                  subject lines, and message content to create new leads. Perfect for importing enquiries that weren't caught by automatic email scanning.
                </p>
              </div>
            </div>
          </SectionCard>
        )}
      </DeskSurface>

      <LeadModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setLeadPreview(null);
        }}
        leadPreview={leadPreview}
        onUpdated={refreshGrouped}
      />

      <CsvImportModal
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        onImportComplete={() => {
          refreshGrouped();
          setCsvImportOpen(false);
        }}
      />
    </>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <LeadsPageContent />
    </Suspense>
  );
}

/* ============================== UI Bits =============================== */

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-sky-100/70 bg-white/80 shadow-[0_26px_60px_-38px_rgba(30,64,175,0.45)] backdrop-blur">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-16 h-44 w-44 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute -bottom-28 -right-14 h-52 w-52 rounded-full bg-amber-200/30 blur-3xl" />
      </div>
      <div className="relative z-10 flex items-center justify-between px-5 py-4 border-b border-sky-100/60">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span aria-hidden="true">📥</span>
          {title}
        </h2>
        {action}
      </div>
      <div className="relative z-10 p-5">{children}</div>
    </section>
  );
}

function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-sky-200/70 bg-white/70 px-6 py-10 text-center text-sm text-slate-500 shadow-inner">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-lg">🌟</div>
      <div className="text-sm font-medium text-slate-600">{title}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-24 rounded-2xl border border-slate-200/60 bg-gradient-to-r from-slate-100/70 via-white/80 to-slate-100/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] animate-pulse"
        />
      ))}
    </div>
  );
}

/* ---------------- Row/Card ---------------- */

function LeadCard({
  lead,
  onOpen,
  onReject,
}: {
  lead: Lead;
  onOpen: () => void;
  onReject: () => void;
}) {
  const subject = lead.custom?.subject as string | undefined;
  const summary = lead.custom?.summary as string | undefined;
  const description =
    typeof lead.description === "string" && lead.description.trim() !== ""
      ? lead.description.trim()
      : typeof lead.custom?.description === "string" && lead.custom.description.trim() !== ""
        ? lead.custom.description.trim()
        : typeof lead.custom?.bodyText === "string" && lead.custom.bodyText.trim() !== ""
          ? lead.custom.bodyText.trim()
          : undefined;
  const statusLabel = STATUS_LABELS[lead.status as LeadStatus] || "—";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-sky-100/70 bg-white/85 p-4 shadow-[0_20px_45px_-36px_rgba(30,64,175,0.55)] backdrop-blur transition-transform hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-32px_rgba(30,64,175,0.55)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-24 h-40 w-40 rounded-full bg-sky-200/40 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-80"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-24 h-40 w-40 rounded-full bg-rose-200/35 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-70"
      />

      <div className="relative z-10 flex items-start gap-3">
        <button onClick={onOpen} className="flex-1 min-w-0 text-left" type="button">
          <div className="flex items-center gap-3">
            <span className="inline-grid h-10 w-10 place-items-center rounded-xl border border-sky-200/80 bg-white/70 text-[12px] font-semibold text-slate-700 shadow-sm">
              {avatarText(lead.contactName)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                {lead.contactName || "Lead"}
              </div>
              {lead.email && <div className="truncate text-xs text-slate-500">{lead.email}</div>}
            </div>
          </div>

          {(subject || summary || description) && (
            <div className="mt-2 space-y-1">
              {subject && <div className="text-xs font-semibold text-slate-700 line-clamp-1">{subject}</div>}
              {summary && <div className="text-[12px] text-slate-600 line-clamp-2">{summary}</div>}
              {description && (
                <div className="text-[12px] text-slate-500/90 italic line-clamp-2">{description}</div>
              )}
            </div>
          )}
        </button>

        <div className="shrink-0 flex flex-col items-end gap-2 text-right">
          {lead.status === "NEW_ENQUIRY" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onReject();
              }}
              type="button"
            >
              ✕ Reject
            </Button>
          )}

          <span
            className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm"
            title="Status (change inside the lead modal)"
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function avatarText(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}