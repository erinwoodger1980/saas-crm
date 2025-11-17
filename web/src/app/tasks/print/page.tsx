"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";

type Task = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  relatedType?: "LEAD" | "PROJECT" | "QUOTE" | "EMAIL" | "QUESTIONNAIRE" | "WORKSHOP" | "OTHER";
  relatedId?: string | null;
  dueAt?: string | null;
  createdAt?: string;
  assignees?: Array<{ userId: string; role: "OWNER" | "FOLLOWER" }>;
};

export default function TasksPrintPage() {
  const router = useRouter();
  const search = useSearchParams();
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";

  const [loading, setLoading] = useState(true);
  const [overdue, setOverdue] = useState<Task[]>([]);
  const [today, setToday] = useState<Task[]>([]);
  const [upcoming, setUpcoming] = useState<Task[]>([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const headers = tenantId ? { "x-tenant-id": tenantId } : undefined;
        const [o, t, u] = await Promise.all([
          apiFetch<{ items: Task[]; total: number }>(`/tasks?status=OPEN&mine=true&due=overdue&includeDone=false`, { headers }),
          apiFetch<{ items: Task[]; total: number }>(`/tasks?status=OPEN&mine=true&due=today&includeDone=false`, { headers }),
          apiFetch<{ items: Task[]; total: number }>(`/tasks?status=OPEN&mine=true&due=upcoming&includeDone=false`, { headers }),
        ]);
        setOverdue(o.items || []);
        setToday(t.items || []);
        setUpcoming(u.items || []);
      } catch (e) {
        console.error("Failed to load tasks for print", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId]);

  // Auto-print if requested via query param
  useEffect(() => {
    if (!loading && (search?.get("auto") === "1")) {
      const t = setTimeout(() => window.print(), 200);
      return () => clearTimeout(t);
    }
  }, [loading, search]);

  const handlePrint = () => window.print();

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-avoid-break { page-break-inside: avoid; }
          .print-break-after { page-break-after: always; }
        }
      `}</style>

      {/* Screen controls */}
      <div className="no-print sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[210mm] items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Link href="/tasks/owner" className="text-sm text-muted-foreground hover:text-foreground">Owner view</Link>
            <Button size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>
      </div>

      {/* Printable content */}
      <div className="mx-auto max-w-[210mm] bg-white p-8">
        <header className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold text-slate-900">My Tasks — Print Sheet</h1>
          <p className="mt-1 text-sm text-slate-600">Generated {new Date().toLocaleString()}</p>
        </header>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-8">
            {/* Overdue */}
            <TaskSection title={`Overdue (${overdue.length})`} items={overdue} tone="text-rose-700" />
            {/* Today */}
            <TaskSection title={`Due today (${today.length})`} items={today} tone="text-indigo-700" />
            {/* Upcoming */}
            <TaskSection title={`Upcoming (${upcoming.length})`} items={upcoming} tone="text-slate-700" />
          </div>
        )}

        <footer className="mt-10 border-t pt-4 text-center text-xs text-slate-500">
          Keep moving — tiny steps compound.
        </footer>
      </div>
    </>
  );
}

function TaskSection({ title, items, tone }: { title: string; items: Task[]; tone?: string }) {
  if (!items?.length) {
    return (
      <section className="print-avoid-break">
        <h2 className={`mb-3 text-lg font-semibold ${tone || ""}`}>{title}</h2>
        <p className="text-sm text-slate-500">No tasks.</p>
      </section>
    );
  }
  return (
    <section className="print-avoid-break">
      <h2 className={`mb-3 text-lg font-semibold ${tone || ""}`}>{title}</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-slate-300">
            <th className="px-2 py-2 text-left font-semibold text-slate-700">Title</th>
            <th className="px-2 py-2 text-left font-semibold text-slate-700">Status</th>
            <th className="px-2 py-2 text-left font-semibold text-slate-700">Priority</th>
            <th className="px-2 py-2 text-left font-semibold text-slate-700">Due</th>
            <th className="px-2 py-2 text-left font-semibold text-slate-700">Related</th>
            <th className="px-2 py-2 text-left font-semibold text-slate-700">Assignees</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} className="border-b border-slate-200 align-top">
              <td className="px-2 py-2 font-medium text-slate-900">{t.title}</td>
              <td className="px-2 py-2 text-slate-700">{formatStatus(t.status)}</td>
              <td className="px-2 py-2">{formatPriority(t.priority)}</td>
              <td className="px-2 py-2 text-slate-800">{formatDate(t.dueAt)}</td>
              <td className="px-2 py-2 text-slate-700">{formatRelated(t.relatedType, t.relatedId)}</td>
              <td className="px-2 py-2 text-slate-700">{formatAssignees(t.assignees)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch { return "—"; }
}
function formatStatus(s: Task["status"]) {
  return s.replace(/_/g, " ");
}
function formatPriority(p: Task["priority"]) {
  const tone: Record<Task["priority"], string> = {
    LOW: "text-slate-600",
    MEDIUM: "text-emerald-700",
    HIGH: "text-amber-700",
    URGENT: "text-rose-700",
  };
  return <span className={`font-semibold ${tone[p]}`}>{p}</span> as unknown as string;
}

function formatRelated(type?: Task["relatedType"], id?: string | null) {
  if (!type && !id) return "—";
  const short = id ? `#${String(id).slice(-6)}` : "";
  return [type || "", short].filter(Boolean).join(" \u00B7 ");
}

function formatAssignees(a?: Task["assignees"]) {
  if (!a || a.length === 0) return "—";
  const owners = a.filter(x => x.role === "OWNER").length;
  const followers = a.filter(x => x.role === "FOLLOWER").length;
  return `${owners} owner${owners===1?"":"s"}${followers?`, ${followers} follower${followers===1?"":"s"}`:""}`;
}
