"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { DeskSurface } from "@/components/DeskSurface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Mail, RefreshCw, Link2, PlusCircle } from "lucide-react";

type InboxAccount = {
  id: string;
  provider: "gmail" | "ms365";
  email: string;
  scope: "tenant" | "user";
  userId?: string;
  userName?: string;
};

type ThreadMessage = {
  id: string;
  messageId: string;
  fromEmail?: string | null;
  toEmail?: string | null;
  subject?: string | null;
  snippet?: string | null;
  sentAt: string;
  direction: string;
  provider: string;
};

type ThreadItem = {
  id: string;
  provider: string;
  threadId: string;
  subject?: string | null;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  updatedAt?: string;
  unread: boolean;
  lastMessage: ThreadMessage | null;
  lead?: { id: string; contactName?: string | null; email?: string | null; number?: string | null } | null;
  opportunity?: { id: string; title: string; number?: string | null; stage?: string | null } | null;
};

type SearchItem = { id: string; contactName?: string | null; email?: string | null; number?: string | null; title?: string | null; stage?: string | null };

type LinkState = {
  threadId: string;
  type: "lead" | "opportunity";
  query: string;
  results: SearchItem[];
  loading: boolean;
};

type Suggestion = {
  isDeliveryConfirmed?: boolean;
  installationStartDate?: string | null;
  installationEndDate?: string | null;
  taskTitle?: string;
  taskDescription?: string;
  confidence?: number;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function InboxPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<InboxAccount[]>([]);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [linkedFilter, setLinkedFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [linkState, setLinkState] = useState<LinkState | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [parsingThreadId, setParsingThreadId] = useState<string | null>(null);
  const [applyingThreadId, setApplyingThreadId] = useState<string | null>(null);
  const importOnOpenRef = useRef(false);

  const refreshThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (accountFilter !== "all") params.set("account", accountFilter);
      if (linkedFilter !== "all") params.set("linked", linkedFilter);
      if (search.trim()) params.set("q", search.trim());
      const data = await apiFetch<{ ok: boolean; threads: ThreadItem[] }>(`/inbox/threads?${params.toString()}`);
      setThreads(data.threads || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [accountFilter, linkedFilter, search]);

  const refreshAccounts = useCallback(async () => {
    try {
      const data = await apiFetch<{ ok: boolean; accounts: InboxAccount[] }>("/inbox/accounts");
      setAccounts(data.accounts || []);
    } catch {}
  }, []);

  const markRead = useCallback(async () => {
    try {
      await apiFetch("/inbox/mark-read", { method: "POST" });
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await ensureDemoAuth();
      if (!ok) return;
      await refreshAccounts();
      await refreshThreads();
      await markRead();
    })();
  }, [markRead, refreshAccounts, refreshThreads]);

  useEffect(() => {
    if (importOnOpenRef.current) return;
    importOnOpenRef.current = true;
    (async () => {
      try {
        await Promise.allSettled([
          apiFetch("/gmail/import", { method: "POST", json: { max: 10, q: "newer_than:30d" } }),
          apiFetch("/ms365/import", { method: "POST", json: { max: 10 } }),
        ]);
      } catch {}
      await refreshThreads();
    })();
  }, [refreshThreads]);

  const onSearch = useMemo(() => {
    let timer: any;
    return (value: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setSearch(value);
      }, 400);
    };
  }, []);

  async function handleRefresh() {
    await refreshThreads();
    await markRead();
  }

  async function handleCreateEnquiry(thread: ThreadItem) {
    const msg = thread.lastMessage;
    if (!msg) return;
    const body = (msg.snippet || msg.subject || "").trim();
    if (!body) {
      toast({ title: "Missing content", description: "No email snippet available to create an enquiry." });
      return;
    }
    try {
      const res = await apiFetch<{ ok?: boolean; leadId?: string; alreadyIngested?: boolean; classified?: { isLead?: boolean } }>(
        "/mail/ingest",
        {
          method: "POST",
          json: {
            provider: msg.provider,
            messageId: msg.messageId,
            from: msg.fromEmail,
            subject: msg.subject || thread.subject || "(no subject)",
            body,
          },
        }
      );
      if (res?.leadId) {
        toast({ title: "Enquiry created", description: "A new lead was created from this email." });
      } else if (res?.alreadyIngested) {
        toast({ title: "Already ingested", description: "This email has already been processed." });
      } else if (res?.classified?.isLead === false) {
        toast({ title: "Not a lead", description: "This email was classified as not a lead." });
      } else {
        toast({ title: "Ingestion complete" });
      }
      await refreshThreads();
    } catch (e: any) {
      toast({ title: "Failed to create enquiry", description: e?.message || "" , variant: "destructive" });
    }
  }

  function startLink(thread: ThreadItem, type: "lead" | "opportunity") {
    const seed = type === "lead" ? thread.lastMessage?.fromEmail || "" : "";
    setLinkState({ threadId: thread.id, type, query: seed, results: [], loading: false });
  }

  async function searchLinks() {
    if (!linkState) return;
    setLinkState({ ...linkState, loading: true });
    try {
      const data = await apiFetch<{ ok: boolean; items: SearchItem[] }>(
        `/inbox/search?type=${linkState.type}&q=${encodeURIComponent(linkState.query)}`
      );
      setLinkState({ ...linkState, results: data.items || [], loading: false });
    } catch (e) {
      setLinkState({ ...linkState, results: [], loading: false });
    }
  }

  async function linkThread(targetId: string) {
    if (!linkState) return;
    try {
      await apiFetch("/inbox/link", {
        method: "POST",
        json: {
          threadId: linkState.threadId,
          leadId: linkState.type === "lead" ? targetId : undefined,
          opportunityId: linkState.type === "opportunity" ? targetId : undefined,
        },
      });
      toast({ title: "Linked", description: "Email thread linked successfully." });
      setLinkState(null);
      await refreshThreads();
    } catch (e: any) {
      toast({ title: "Link failed", description: e?.message || "" , variant: "destructive" });
    }
  }

  async function parseThread(thread: ThreadItem) {
    setParsingThreadId(thread.id);
    try {
      const data = await apiFetch<{ ok: boolean; suggestion: Suggestion }>("/inbox/parse-thread", {
        method: "POST",
        json: { threadId: thread.id },
      });
      setSuggestions((prev) => ({ ...prev, [thread.id]: data.suggestion || {} }));
      toast({ title: "Suggestion ready" });
    } catch (e: any) {
      toast({ title: "Parse failed", description: e?.message || "", variant: "destructive" });
    } finally {
      setParsingThreadId(null);
    }
  }

  async function applySuggestion(threadId: string) {
    const suggestion = suggestions[threadId];
    if (!suggestion) return;
    setApplyingThreadId(threadId);
    try {
      await apiFetch("/inbox/apply-suggestion", {
        method: "POST",
        json: { threadId, suggestion },
      });
      toast({ title: "Task created", description: "Task and installation dates applied." });
      setSuggestions((prev) => {
        const next = { ...prev };
        delete next[threadId];
        return next;
      });
    } catch (e: any) {
      toast({ title: "Apply failed", description: e?.message || "", variant: "destructive" });
    } finally {
      setApplyingThreadId(null);
    }
  }

  return (
    <DeskSurface innerClassName="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Inbox</div>
          <h1 className="text-2xl font-semibold text-slate-900">Email triage</h1>
          <p className="text-sm text-slate-500">Review inbound emails, link them to leads, quotes, or orders.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleRefresh} type="button">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh inbox
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Account</span>
          <select
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="all">All accounts</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.email}>
                {acc.email} {acc.scope === "user" ? `(${acc.userName || "user"})` : "(tenant)"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Linked</span>
          <select
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
            value={linkedFilter}
            onChange={(e) => setLinkedFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="linked">Linked</option>
            <option value="unlinked">Unlinked</option>
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <Input
            placeholder="Search subject, sender, or snippet"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <div className="text-xs text-slate-500">Attachments are fetched only after linking.</div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading inbox…</div>
      ) : threads.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No email threads found.</div>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => {
            const msg = thread.lastMessage;
            return (
              <div key={thread.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-semibold text-slate-900">
                        {thread.subject || msg?.subject || "(no subject)"}
                      </span>
                      {thread.unread && <Badge variant="destructive">Unread</Badge>}
                      <Badge variant="secondary">{thread.provider}</Badge>
                    </div>
                    <div className="text-xs text-slate-500">
                      {msg?.fromEmail || "Unknown sender"} · {formatDate(msg?.sentAt || thread.updatedAt)}
                    </div>
                    {msg?.snippet && <p className="text-sm text-slate-600">{msg.snippet}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreateEnquiry(thread)}
                      disabled={!msg}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create enquiry
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startLink(thread, "lead")}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Link lead
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startLink(thread, "opportunity")}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Link quote/order
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => parseThread(thread)}
                      disabled={parsingThreadId === thread.id}
                    >
                      {parsingThreadId === thread.id ? "Parsing…" : "Parse & suggest"}
                    </Button>
                  </div>
                </div>

                {(thread.lead || thread.opportunity) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    {thread.lead && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1">
                        Lead: {thread.lead.contactName || thread.lead.email || thread.lead.number || thread.lead.id}
                      </span>
                    )}
                    {thread.opportunity && (
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1">
                        Quote/Order: {thread.opportunity.title || thread.opportunity.number || thread.opportunity.id}
                      </span>
                    )}
                  </div>
                )}

                {linkState && linkState.threadId === thread.id && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={linkState.query}
                        onChange={(e) => setLinkState({ ...linkState, query: e.target.value })}
                        placeholder={linkState.type === "lead" ? "Search leads by name or email" : "Search quotes/orders by title"}
                      />
                      <Button size="sm" onClick={searchLinks} disabled={linkState.loading}>
                        {linkState.loading ? "Searching…" : "Search"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setLinkState(null)}>
                        Cancel
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {linkState.results.length === 0 ? (
                        <div className="text-xs text-slate-500">No matches yet.</div>
                      ) : (
                        linkState.results.map((item) => (
                          <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div className="text-sm text-slate-700">
                              {linkState.type === "lead"
                                ? `${item.contactName || "Lead"} · ${item.email || ""} ${item.number ? `#${item.number}` : ""}`
                                : `${item.title || "Opportunity"} ${item.number ? `#${item.number}` : ""}`}
                            </div>
                            <Button size="sm" onClick={() => linkThread(item.id)}>Link</Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {suggestions[thread.id] && (
                  <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-indigo-900">AI suggestion</div>
                        <div className="text-xs text-indigo-700">
                          Confidence: {typeof suggestions[thread.id].confidence === "number" ? `${Math.round((suggestions[thread.id].confidence || 0) * 100)}%` : "–"}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => applySuggestion(thread.id)}
                        disabled={applyingThreadId === thread.id}
                      >
                        {applyingThreadId === thread.id ? "Applying…" : "Create task & apply dates"}
                      </Button>
                    </div>
                    <div className="mt-3 text-sm text-indigo-900">
                      <div className="font-medium">{suggestions[thread.id].taskTitle || "Delivery confirmed"}</div>
                      <div className="text-xs text-indigo-700">{suggestions[thread.id].taskDescription}</div>
                    </div>
                    {(suggestions[thread.id].installationStartDate || suggestions[thread.id].installationEndDate) && (
                      <div className="mt-2 text-xs text-indigo-700">
                        Installation dates: {suggestions[thread.id].installationStartDate || "?"} → {suggestions[thread.id].installationEndDate || "?"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DeskSurface>
  );
}
