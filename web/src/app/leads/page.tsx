// web/src/app/leads/page.tsx
"use client";

import React, { useEffect, useMemo, useState, Suspense, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CustomizableGrid } from "@/components/CustomizableGrid";
import { ColumnConfigModal } from "@/components/ColumnConfigModal";
import DropdownOptionsEditor from "@/components/DropdownOptionsEditor";
import { Table, LayoutGrid } from "lucide-react";
// Robust dynamic import with typed props & fallback component
interface LeadModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadPreview: Lead | null;
  onUpdated?: () => void | Promise<void>;
  initialStage?: 'client' | 'quote' | 'dates' | 'finance' | 'tasks' | 'order';
  showFollowUp?: boolean;
  scrollToNotes?: boolean;
}

const LeadModal = dynamic<LeadModalProps>(
  () =>
    import("./LeadModal")
      .then((m) => ({ default: m.default }))
      .catch((err) => {
        console.error("LeadModal dynamic import failed:", err);
        const Fallback: React.FC<LeadModalProps> = (props) => {
          if (!props.open) return null;
          return (
            <div
              className="fixed inset-0 z-[60] bg-black/20 backdrop-blur flex items-center justify-center p-6"
              role="dialog"
              aria-modal="true"
              onClick={() => props.onOpenChange(false)}
            >
              <div
                className="max-w-lg w-full rounded-xl bg-white shadow p-6 border border-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-sm font-semibold mb-2">Lead modal failed to load</div>
                <div className="text-sm text-slate-600 mb-4">Please retry or refresh the page.</div>
                <div className="flex justify-end">
                  <button
                    className="rounded-md border px-3 py-2 text-sm"
                    onClick={() => props.onOpenChange(false)}
                    type="button"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        };
        return { default: Fallback } as any;
      }),
  { ssr: false, loading: () => null }
);
const CsvImportModal = dynamic(() => import("@/components/leads/CsvImportModal"), { ssr: false });
import type { Lead } from "./LeadModal";
import { on } from "@/lib/events";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";
import { DeskSurface } from "@/components/DeskSurface";
import { useTenantBrand } from "@/lib/use-tenant-brand";
import { LatestTaskCell } from "@/components/leads/LatestTaskCell";
import { buildLeadDisplayName } from "@/lib/leadDisplayName";

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

// Available fields for column configuration
const AVAILABLE_LEAD_FIELDS = [
  { field: 'displayName', label: 'Name', type: 'text' },
  { field: 'contactName', label: 'Contact Name', type: 'text' },
  { field: 'email', label: 'Email', type: 'email' },
  { field: 'phone', label: 'Phone', type: 'phone' },
  { field: 'number', label: 'Lead #', type: 'text' },
  { field: 'latestTask', label: 'Latest task', type: 'custom' },
  { field: 'latestCommunication', label: 'Latest note', type: 'custom' },
  {
    field: 'status',
    label: 'Status',
    type: 'dropdown',
    dropdownOptions: ACTIVE_TABS,
    dropdownColors: {
      'NEW_ENQUIRY': 'bg-blue-100 text-blue-700 border-blue-200',
      'INFO_REQUESTED': 'bg-orange-100 text-orange-700 border-orange-200',
      'DISQUALIFIED': 'bg-red-100 text-red-700 border-red-200',
      'REJECTED': 'bg-slate-100 text-slate-700 border-slate-200',
      'READY_TO_QUOTE': 'bg-purple-100 text-purple-700 border-purple-200',
      'QUOTE_SENT': 'bg-green-100 text-green-700 border-green-200',
      'WON': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'LOST': 'bg-gray-100 text-gray-700 border-gray-200',
    }
  },
  { field: 'description', label: 'Description', type: 'text' },
  { field: 'estimatedValue', label: 'Est. Value', type: 'currency' },
  { field: 'quotedValue', label: 'Quoted Value', type: 'currency' },
  { field: 'dateQuoteSent', label: 'Quote Sent Date', type: 'date' },
  { field: 'capturedAt', label: 'Captured At', type: 'date' },
  { field: 'quoteStatus', label: 'Quote Status', type: 'text' },
  { field: 'custom.companyName', label: 'Company', type: 'text' },
  { field: 'custom.address', label: 'Address', type: 'text' },
  { field: 'custom.city', label: 'City', type: 'text' },
  { field: 'custom.postcode', label: 'Postcode', type: 'text' },
  { field: 'custom.source', label: 'Source', type: 'text' },
  { field: 'custom.projectType', label: 'Project Type', type: 'text' },
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
    bodyText?: string;
  };
  error?: string;
};

function LeadsPageContent() {
  // dropdown customization state
  const [customColors, setCustomColors] = useState<Record<string, { bg: string; text: string }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('leads-custom-colors');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });

  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('leads-dropdown-options');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });

  const [editingField, setEditingField] = useState<string | null>(null);

  // Per-lead latest task (for grid column)
  const [latestTaskByLeadId, setLatestTaskByLeadId] = useState<Record<string, any | null>>({});
  
  // New lead description modal
  const [newLeadModalOpen, setNewLeadModalOpen] = useState(false);
  const [newLeadDescription, setNewLeadDescription] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [newLeadNoEmail, setNewLeadNoEmail] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadClientId, setNewLeadClientId] = useState<string | null>(null);
  const [creatingLead, setCreatingLead] = useState(false);
  const [availableClients, setAvailableClients] = useState<Array<{ id: string; name: string; email?: string }>>([]);

  // Load column config for current tab
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`leads-column-config-${tab}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const migrated = Array.isArray(parsed)
            ? parsed.map((col: any) => {
                if (col?.field === 'contactName' && col?.label === 'Name') {
                  return { ...col, field: 'displayName', type: 'text', render: undefined };
                }
                return col;
              })
            : parsed;
          const ensureLatestCommunication = (cols: any[]) => {
            if (cols.some((c) => c?.field === 'latestCommunication')) return cols;
            const insertAfter = cols.findIndex((c) => c?.field === 'latestTask');
            const next = [...cols];
            next.splice(Math.max(0, insertAfter + 1), 0, {
              field: 'latestCommunication',
              label: 'Latest note',
              visible: true,
              frozen: false,
              width: 360,
              type: 'custom',
            });
            return next;
          };
          setColumnConfig(Array.isArray(migrated) ? ensureLatestCommunication(migrated) : migrated);
        } catch {
          setColumnConfig([
            { 
              field: 'displayName', 
              label: 'Name', 
              visible: true, 
              frozen: true, 
              width: 250, 
              type: 'text'
            },
            { field: 'email', label: 'Email', visible: true, frozen: false, width: 200 },
            { field: 'phone', label: 'Phone', visible: true, frozen: false, width: 150 },
            { field: 'latestTask', label: 'Latest task', visible: true, frozen: false, width: 320, type: 'custom' },
            { field: 'latestCommunication', label: 'Latest note', visible: true, frozen: false, width: 360, type: 'custom' },
            { field: 'status', label: 'Status', visible: true, frozen: false, width: 150, type: 'dropdown' },
          ]);
        }
      } else {
        setColumnConfig([
          { 
            field: 'displayName', 
            label: 'Name', 
            visible: true, 
            frozen: true, 
            width: 250, 
            type: 'text'
          },
          { field: 'email', label: 'Email', visible: true, frozen: false, width: 200 },
          { field: 'phone', label: 'Phone', visible: true, frozen: false, width: 150 },
          { field: 'latestTask', label: 'Latest task', visible: true, frozen: false, width: 320, type: 'custom' },
          { field: 'latestCommunication', label: 'Latest note', visible: true, frozen: false, width: 360, type: 'custom' },
          { field: 'status', label: 'Status', visible: true, frozen: false, width: 150, type: 'dropdown' },
        ]);
      }
    }
  }, [tab]);

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

    // Prefer fetching canonical lead data for modal opens so we don't
    // accidentally use a board-normalized status (e.g. ESTIMATE).
    try {
      const res = await apiFetch<any>(`/leads/${leadId}`, {
        headers: buildAuthHeaders(),
      });
      const l = (res && typeof res === "object" && "lead" in res ? (res as any).lead : res) as Lead | null;
      if (l?.id) {
        openLead(l);
        return;
      }
    } catch {
      // fall back
    }

    if (found) {
      openLead(found);
      return;
    }
  }, [grouped]);

  useEffect(() => {
    const leadId = searchParams?.get?.('leadId');
    const modal = searchParams?.get?.('modal');
    if (leadId && modal === 'lead') openLeadById(leadId);
  }, [searchParams, openLeadById]);

  const refreshGrouped = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Grouped>("/leads/grouped", {
        headers: buildAuthHeaders(),
      });
      const normalised = normaliseToNewStatuses(data);
      setGrouped(normalised);
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

  function openLead(l: Lead, opts?: { stage?: 'client' | 'quote' | 'tasks'; scrollToNotes?: boolean }) {
    setLeadPreview(l);
    setLeadModalScrollToNotes(Boolean(opts?.scrollToNotes));
    setLeadModalInitialStage(opts?.stage ?? (l.clientId ? 'client' : 'tasks'));
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

    // Helpers to reduce obvious email-import duplicates (same message/thread/subject)
    const normalizeSubject = (s: unknown): string => {
      if (typeof s !== "string") return "";
      const lower = s.trim().toLowerCase();
      // strip common prefixes and excessive whitespace
      return lower
        .replace(/^(re|fw|fwd)\s*:\s*/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 240);
    };
    const normalizeEmail = (s: unknown): string => {
      if (typeof s !== "string") return "";
      return s.trim().toLowerCase();
    };
    const dedupeKey = (l: any): string | null => {
      const c = l?.custom || l?.briefJson || null;
      const msgId = typeof c?.messageId === "string" && c.messageId.trim() ? c.messageId.trim() : undefined;
      if (msgId) return `msg:${msgId.toLowerCase()}`;
      const threadId = typeof c?.threadId === "string" && c.threadId.trim() ? c.threadId.trim() : undefined;
      const subject = normalizeSubject(c?.subject || l?.subject);
      const fromEmail = normalizeEmail(c?.fromEmail || l?.email);
      if (threadId && subject) return `thread:${threadId}|${subject}`;
      if (fromEmail && subject) return `fromsub:${fromEmail}|${subject}`;
      return null;
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

    const seenIds = new Set<string>();
    const seenSigs = new Set<string>();
    const insert = (l: any) => {
      if (!l?.id) return;
      if (seenIds.has(l.id)) return;
      const sig = dedupeKey(l);
      if (sig && seenSigs.has(sig)) return;

      seenIds.add(l.id);
      if (sig) seenSigs.add(sig);
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

      (normalized as any).displayName = buildLeadDisplayName({
        contactName: normalized.contactName,
        number: (normalized as any).number ?? l.number ?? null,
        description: normalized.description,
        custom: normalized.custom,
        fallbackLabel: "Lead",
      });

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
    let filtered = list.filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
    return filtered;
  }, [grouped, tab]);

  // Fetch latest tasks for the currently visible rows (grid column)
  useEffect(() => {
    if (viewMode !== 'grid') return;
    const ids = rows.map((r) => r.id).filter(Boolean);
    if (ids.length === 0) {
      setLatestTaskByLeadId({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const resp = await apiFetch<any>(
          `/tasks/latest?relatedType=LEAD&relatedIds=${encodeURIComponent(ids.join(','))}&mine=false`,
          { headers: buildAuthHeaders() }
        );
        if (cancelled) return;
        setLatestTaskByLeadId(resp?.byRelatedId || {});
      } catch (e) {
        if (cancelled) return;
        console.warn('[leads] latest task fetch failed:', e);
        setLatestTaskByLeadId({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rows, viewMode]);

  const gridColumns = useMemo(() => {
    return (columnConfig || []).map((c: any) => {
      if (c?.field === 'latestTask') {
        return {
          ...c,
          type: 'custom',
          render: (row: any) => (
            <LatestTaskCell
              task={latestTaskByLeadId?.[row.id]}
              lead={row}
              onChanged={refreshGrouped}
            />
          ),
        };
      }
      if (c?.field === 'latestCommunication') {
        return {
          ...c,
          type: 'custom',
          render: (row: any) => {
            const snippet = getLatestCommunicationNoteSnippet(row);
            if (!snippet) return <span className="text-xs text-slate-400">-</span>;
            return (
              <button
                type="button"
                className="text-left text-xs text-slate-700 hover:underline line-clamp-2"
                onClick={(e) => {
                  e.stopPropagation();
                  openLead(row, { stage: 'client', scrollToNotes: true });
                }}
                title={snippet}
              >
                {snippet}
              </button>
            );
          },
        };
      }
      return c;
    });
  }, [columnConfig, latestTaskByLeadId, refreshGrouped]);

  async function handleCreateLeadManual(input: { email?: string; noEmail?: boolean; contactName?: string; description?: string; clientId?: string | null }) {
    const noEmail = Boolean(input.noEmail);
    const email = (input.email || "").trim();
    const contactName = (input.contactName || "").trim();
    const description = (input.description || "").trim();
    if (!noEmail) {
      if (!email) {
        toast({ title: "Email required", description: "Enter an email to create the lead (or tick No email).", variant: "destructive" });
        return;
      }
      // Simple client-side validation to prevent empty/obviously invalid values
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        toast({ title: "Invalid email", description: "Enter a valid email address.", variant: "destructive" });
        return;
      }
    }
    
    setCreatingLead(true);
    let leadCreated = false;
    let leadId: string | null = null;
    
    try {
      const lead = await apiFetch<any>("/leads", {
        method: "POST",
        headers: buildAuthHeaders(),
        json: {
          contactName: contactName || "Manual Lead",
          ...(noEmail ? { noEmail: true } : { email }),
          description: description || null,
          // When no email is provided, skip trying to link to a client.
          ...(noEmail ? {} : { clientId: input.clientId || null }),
          custom: { provider: "manual" },
        },
      });
      
      leadCreated = true;
      leadId = lead?.id || null;
      
      await refreshGrouped();
      
      if (lead?.id) {
        try {
          openLead({
            id: lead.id,
            contactName: lead.contactName ?? "",
            email: lead.email ?? "",
            status: (lead.status as LeadStatus) ?? "NEW_ENQUIRY",
            clientId: lead.clientId ?? null,
            custom: lead.custom ?? { provider: "manual" },
            description:
              (typeof lead.description === "string" && lead.description.trim() !== ""
                ? lead.description.trim()
                : typeof lead.custom?.description === "string"
                  ? lead.custom.description.trim()
                  : null) ?? null,
          });
        } catch (openErr) {
          console.error("Failed to open lead modal:", openErr);
          // Lead was created, just couldn't open modal - show success anyway
        }
      }
      
      toast({
        title: "Lead created",
        description: noEmail ? `${contactName || "Lead"} created.` : `${email} added to your inbox.`,
      });
    } catch (e: any) {
      console.error("Lead creation error:", e);
      
      // If lead was created but something else failed, still show success
      if (leadCreated) {
        toast({
          title: "Lead created",
          description: noEmail ? `${contactName || "Lead"} created.` : `${email} added to your inbox.`,
        });
        await refreshGrouped();
        return;
      }
      
      const rawMessage = typeof e?.message === "string" ? e.message : "Please try again.";
      const cleaned = rawMessage.replace(/\sfor\shttps?:\/\/\S+/, "").trim();
      toast({
        title: "Failed to create lead",
        description: cleaned || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingLead(false);
      setNewLeadModalOpen(false);
      setNewLeadDescription("");
      setNewLeadEmail("");
      setNewLeadNoEmail(false);
      setNewLeadName("");
      setNewLeadClientId(null);
    }
  }
  
  function handleCreateLead() {
    setNewLeadModalOpen(true);
    setNewLeadDescription("");
    setNewLeadEmail("");
    setNewLeadNoEmail(false);
    setNewLeadName("");
    setNewLeadClientId(null);
    loadAvailableClients();
  }

  async function loadAvailableClients() {
    try {
      const clients = await apiFetch<any[]>("/clients", {
        headers: buildAuthHeaders(),
      });
      if (Array.isArray(clients)) {
        setAvailableClients(clients.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      }
    } catch (err) {
      console.error("Failed to load clients:", err);
    }
  }

  function handleClientSelect(clientId: string) {
    if (newLeadNoEmail) return;
    setNewLeadClientId(clientId);
    const client = availableClients.find(c => c.id === clientId);
    if (client) {
      setNewLeadName(client.name || "");
      setNewLeadEmail(client.email || "");
    }
  }

  /* ------------------------------ Email Upload Functions ------------------------------ */

  function extractMessageRefFromText(input: string): string | null {
    const raw = String(input || "").trim();
    if (!raw) return null;

    // Apple Mail often provides message:%3C...%3E
    const decoded = (() => {
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    })();

    const s = decoded.trim();
    if (/^message:/i.test(s)) return s;
    return null;
  }

  async function extractEmailRefFromDataTransfer(dt: DataTransfer): Promise<string | null> {
    const items = dt.items ? Array.from(dt.items) : [];

    const stringItems = items.filter((it) => it.kind === "string");
    const strings = await Promise.all(
      stringItems.map(
        (it) =>
          new Promise<string>((resolve) => {
            try {
              it.getAsString((data) => resolve(String(data || "")));
            } catch {
              resolve("");
            }
          })
      )
    );

    for (const s of strings) {
      const ref = extractMessageRefFromText(s);
      if (ref) return ref;
    }

    const tryTypes = ["text/plain", "text/uri-list", "text/html"];
    for (const t of tryTypes) {
      try {
        const v = dt.getData(t);
        const ref = extractMessageRefFromText(v);
        if (ref) return ref;
      } catch {}
    }

    return null;
  }

  async function extractEmailFilesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
    const directFiles = Array.from(dt.files || []);
    if (directFiles.length > 0) return directFiles;

    const items = dt.items ? Array.from(dt.items) : [];
    const itemFiles = items
      .filter((it) => it.kind === "file")
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);
    if (itemFiles.length > 0) return itemFiles;

    return [];
  }

  function handleEmailDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    
    const hasFilesType = e.dataTransfer.types.includes('Files');
    const hasFileItems = Array.from(e.dataTransfer.items || []).some((it) => it.kind === 'file');
    const hasStringItems = Array.from(e.dataTransfer.items || []).some((it) => it.kind === 'string');
    if (hasFilesType || hasFileItems || hasStringItems) {
      console.log('🎯 Email drag operation detected');
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

  async function handleEmailDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const dt = e.dataTransfer;
    const types = Array.from(dt.types || []);
    const items = Array.from(dt.items || []).map((it) => ({ kind: it.kind, type: it.type }));
    const files = await extractEmailFilesFromDataTransfer(dt);
    console.log('📧 Email drop detected', { extractedFiles: files.length, types, items });
    if (files.length > 0) {
      console.log('📧 Processing files:', files.map(f => f.name).join(', '));
      addEmailFilesToQueue(files);
      return;
    }

    // Apple Mail sometimes drops only a message: reference. Resolve it via the server using the user's connected mailbox.
    const ref = await extractEmailRefFromDataTransfer(dt);
    if (ref) {
      try {
        toast({
          title: "Importing email…",
          description: "Fetching the email from your connected mailbox",
          duration: 3500,
        });

        const headers = buildAuthHeaders();
        const response = await apiFetch<{
          leadId: string;
          contactName: string;
          email: string;
          subject: string;
          confidence: number;
          bodyText?: string;
        }>(`/leads/parse-email-ref`, {
          method: 'POST',
          headers,
          json: { ref, provider: 'manual' },
        });

        toast({
          title: "Email processed successfully",
          description: `Created lead for ${response.contactName} with ${(response.confidence * 100).toFixed(0)}% confidence`,
          duration: 4000,
        });
        await refreshGrouped();
        return;
      } catch (error: any) {
        toast({
          title: "Email import failed",
          description: error?.message || "We couldn't fetch the dropped email from your mailbox. Try saving it as a .eml file and uploading it.",
          variant: "destructive",
        });
        return;
      }
    }

    toast({
      title: "Nothing to import",
      description: "No email file was detected in that drag-drop. Try saving the email as a .eml file and dropping it, or use Browse Files.",
      variant: "destructive",
    });
  }

  function handleEmailFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addEmailFilesToQueue(files);
    }
  }

  // View toggle handler
  function toggleViewMode() {
    const newMode = viewMode === 'cards' ? 'grid' : 'cards';
    setViewMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('leads-view-mode', newMode);
    }
  }

  // Column config save handler
  function handleSaveColumnConfig(newConfig: any[]) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`leads-column-config-${tab}`, JSON.stringify(newConfig));
    }
    setColumnConfig(newConfig);
    setShowColumnConfig(false);
  }

  // Handle cell change in grid
  async function handleCellChange(leadId: string, field: string, value: any) {
    try {
      await apiFetch(`/leads/${leadId}`, {
        method: 'PATCH',
        headers: buildAuthHeaders(),
        body: JSON.stringify({ [field]: value }),
      });
      // Refresh data
      await refreshGrouped();
      toast({
        title: "Lead updated",
        description: "Changes saved successfully",
      });
    } catch (e: any) {
      toast({
        title: "Update failed",
        description: e?.message || "Failed to update lead",
        variant: "destructive",
      });
    }
  }

  // Handle saving custom colors and dropdown options
  function handleSaveDropdownOptions(field: string, options: string[], colors: Record<string, { bg: string; text: string }>) {
    // Save dropdown options
    const newOptions = { ...dropdownOptions, [field]: options };
    setDropdownOptions(newOptions);
    localStorage.setItem('leads-dropdown-options', JSON.stringify(newOptions));

    // Save custom colors
    setCustomColors(colors);
    localStorage.setItem('leads-custom-colors', JSON.stringify(colors));

    toast({
      title: "Options updated",
      description: `Dropdown options and colors saved for ${field}`,
    });
  }

  function addEmailFilesToQueue(files: File[]) {
    // Filter for email-like files (.eml, .msg, .txt, .mbox) and check MIME types
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
              title="Capture and triage enquiries. Quotes page carries the estimate and quote journey through to win."
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
              onClick={toggleViewMode}
              title={viewMode === 'cards' ? 'Switch to Grid View' : 'Switch to Card View'}
            >
              {viewMode === 'cards' ? <LayoutGrid className="h-4 w-4" /> : <Table className="h-4 w-4" />}
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
          {/* Removed manual quotes toggle */}
        </div>

        <SectionCard
          title="Inbox"
          action={
            <div className="flex items-center gap-3">
              {viewMode === 'grid' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColumnConfig(true)}
                  type="button"
                >
                  Customize Columns
                </Button>
              )}
              <span className="text-xs font-medium text-slate-500">
                {loading ? "Syncing…" : `${rows.length} in "${STATUS_LABELS[tab]}"`}
              </span>
            </div>
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
          ) : viewMode === 'grid' ? (
            <CustomizableGrid
              data={rows}
              columns={gridColumns}
              onRowClick={openLead}
              onCellChange={handleCellChange}
              customColors={customColors}
              customDropdownOptions={dropdownOptions}
              onEditColumnOptions={(field) => setEditingField(field)}
            />
          ) : (
            <div className="grid gap-3">
              {rows.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onOpen={() => openLead(lead)}
                  onOpenNotes={() => openLead(lead, { stage: 'client', scrollToNotes: true })}
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
                onClick={() => document.getElementById('email-file-input')?.click()}
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
                  className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
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

      {/* Mount modals only when needed to avoid import-time crashes */}
      {open && (
        <ErrorBoundary
          fallback={<div className="p-4 text-sm text-red-600 border rounded bg-red-50">Lead modal failed to load.</div>}
        >
          <LeadModal
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) {
                setLeadPreview(null);
                setLeadModalScrollToNotes(false);
              }
            }}
            leadPreview={leadPreview}
            onUpdated={refreshGrouped}
            initialStage={leadModalInitialStage}
            scrollToNotes={leadModalScrollToNotes}
          />
        </ErrorBoundary>
      )}

      {csvImportOpen && (
        <CsvImportModal
          open={csvImportOpen}
          onClose={() => setCsvImportOpen(false)}
          onImportComplete={() => {
            refreshGrouped();
            setCsvImportOpen(false);
          }}
        />
      )}

      <ColumnConfigModal
        open={showColumnConfig}
        onClose={() => setShowColumnConfig(false)}
        availableFields={AVAILABLE_LEAD_FIELDS}
        currentConfig={columnConfig}
        onSave={handleSaveColumnConfig}
      />

      {editingField && (
        <DropdownOptionsEditor
          isOpen={!!editingField}
          onClose={() => setEditingField(null)}
          fieldName={editingField}
          fieldLabel={columnConfig.find(c => c.field === editingField)?.label || editingField}
          currentOptions={dropdownOptions[editingField] || columnConfig.find(c => c.field === editingField)?.dropdownOptions || []}
          currentColors={customColors}
          onSave={(options, colors) => handleSaveDropdownOptions(editingField, options, colors)}
        />
      )}

      {/* New Lead Description Modal */}
      {newLeadModalOpen && (
        <div 
          className="fixed inset-0 z-[70] bg-black/20 backdrop-blur flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !creatingLead && setNewLeadModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Create New Lead</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Existing Client (optional)</label>
                <select
                  value={newLeadClientId || ""}
                  onChange={(e) => handleClientSelect(e.target.value)}
                  disabled={creatingLead || newLeadNoEmail}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">Select a client...</option>
                  {availableClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input
                  autoFocus
                  type="email"
                  placeholder="customer@example.com"
                  value={newLeadEmail}
                  onChange={(e) => setNewLeadEmail(e.target.value)}
                  disabled={creatingLead || newLeadNoEmail}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newLeadNoEmail}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setNewLeadNoEmail(next);
                    if (next) {
                      setNewLeadEmail("");
                      setNewLeadClientId(null);
                    }
                  }}
                  disabled={creatingLead}
                  className="h-4 w-4 rounded border-slate-300"
                />
                No email
              </label>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Name (optional)</label>
                <input
                  type="text"
                  placeholder="Customer name"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  disabled={creatingLead}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lead Description (optional)
                </label>
                <textarea
                  placeholder="Enter lead details, project description, or notes..."
                  value={newLeadDescription}
                  onChange={(e) => setNewLeadDescription(e.target.value)}
                  disabled={creatingLead}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-500 min-h-[100px] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => !creatingLead && setNewLeadModalOpen(false)}
                  disabled={creatingLead}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateLeadManual({ email: newLeadEmail, noEmail: newLeadNoEmail, contactName: newLeadName, description: newLeadDescription, clientId: newLeadClientId })}
                  disabled={creatingLead || (!newLeadNoEmail && !newLeadEmail.trim())}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {creatingLead ? "Creating..." : "Create Lead"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
  onOpenNotes,
  onReject,
}: {
  lead: Lead;
  onOpen: () => void;
  onOpenNotes: () => void;
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

  const normalizeSnippet = (s?: string) =>
    typeof s === "string" ? s.trim().replace(/\s+/g, " ").toLowerCase() : "";

  const summaryToShow = summary;
  const descriptionToShow = (() => {
    if (!description) return undefined;
    if (summaryToShow && normalizeSnippet(summaryToShow) === normalizeSnippet(description)) return undefined;
    return description;
  })();
  const statusLabel = STATUS_LABELS[lead.status as LeadStatus] || "—";
  const needsManualQuote = Boolean(lead.custom?.needsManualQuote);
  const manualQuoteReason = typeof lead.custom?.manualQuoteReason === 'string' ? lead.custom.manualQuoteReason : undefined;
  const latestNoteSnippet = getLatestCommunicationNoteSnippet(lead);
  const enquiryAt = (lead as any).capturedAt ?? (lead as any).createdAt ?? null;
  const enquiryAtLabel = formatUiDate(enquiryAt);

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
        <div className="flex-1 min-w-0 text-left">
          <button onClick={onOpen} className="w-full text-left" type="button">
            <div className="flex items-center gap-3">
              <span className="inline-grid h-10 w-10 place-items-center rounded-xl border border-sky-200/80 bg-white/70 text-[12px] font-semibold text-slate-700 shadow-sm">
                {avatarText(lead.contactName)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {buildLeadDisplayName({
                    contactName: lead.contactName,
                    number: (lead as any).number ?? null,
                    description: lead.description,
                    custom: lead.custom,
                    fallbackLabel: "Lead",
                  })}
                </div>
                {lead.email && <div className="truncate text-xs text-slate-500">{lead.email}</div>}
                {enquiryAtLabel && <div className="truncate text-xs text-slate-500">Enquiry: {enquiryAtLabel}</div>}
              </div>
            </div>

            {(subject || summaryToShow || descriptionToShow) && (
              <div className="mt-2 space-y-1">
                {subject && <div className="text-xs font-semibold text-slate-700 line-clamp-1">{subject}</div>}
                {summaryToShow && <div className="text-[12px] text-slate-600 line-clamp-2">{summaryToShow}</div>}
                {descriptionToShow && (
                  <div className="text-[12px] text-slate-500/90 italic line-clamp-2">{descriptionToShow}</div>
                )}
                {needsManualQuote && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-50/70 px-2 py-1 text-[10px] font-medium text-amber-800" title={manualQuoteReason ? `Manual quote required: ${manualQuoteReason}` : 'Manual quote required'}>
                    <span>⚠️ Manual quote</span>
                  </div>
                )}
              </div>
            )}
          </button>

          {latestNoteSnippet && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenNotes();
              }}
              className="mt-2 block w-full text-left text-[12px] text-slate-600 hover:text-slate-700 hover:underline line-clamp-1"
              title={latestNoteSnippet}
            >
              “{latestNoteSnippet}”
            </button>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2 text-right">
          {/* Task Count Badge */}
          {lead.taskCount !== undefined && lead.taskCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
                // Wait a moment then switch to tasks tab
                setTimeout(() => {
                  const event = new CustomEvent('lead-modal-set-stage', { detail: { stage: 'tasks' } });
                  window.dispatchEvent(event);
                }, 100);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              title={`${lead.taskCount} open task${lead.taskCount !== 1 ? 's' : ''}`}
              type="button"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {lead.taskCount}
            </button>
          )}
          
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
          {needsManualQuote && (
            <span
              className="inline-flex items-center rounded-full border border-amber-300/80 bg-amber-100/80 px-2 py-1 text-[10px] font-semibold text-amber-800 shadow-sm"
              title={manualQuoteReason ? `Manual quote required: ${manualQuoteReason}` : 'Manual quote required'}
            >
              Manual Quote
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatUiDate(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function avatarText(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getLatestCommunicationNoteSnippet(lead: any): string | null {
  const raw = typeof lead?.custom?.communicationNotes === "string" ? String(lead.custom.communicationNotes) : "";
  const notes = raw.trim();
  if (!notes) return null;

  const firstEntry = notes.split(/\n\s*\n/)[0]?.trim() || "";
  if (!firstEntry) return null;

  const maxLen = 140;
  return firstEntry.length > maxLen ? `${firstEntry.slice(0, maxLen - 1)}…` : firstEntry;
}

// Simple client-side error boundary
class ErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: any, info: any) { console.error('Lead modal error boundary caught:', err, info); }
  render() { if (this.state.hasError) return this.props.fallback; return this.props.children; }
}