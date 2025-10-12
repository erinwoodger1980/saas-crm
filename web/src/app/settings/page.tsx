"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import SourceCosts from "./SourceCosts";

/* -------- Types -------- */
type QField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  required?: boolean;
  options?: string[];
};
type Settings = {
  tenantId: string;
  slug: string;
  brandName: string;
  introHtml?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  links?: { label: string; url: string }[] | null;
  questionnaire?: QField[] | null;
};
type InboxCfg = { gmail: boolean; ms365: boolean; intervalMinutes: number };
type CostRow = {
  id: string;
  tenantId: string;
  source: string;
  month: string; // ISO
  spend: number;
  leads: number;
  conversions: number;
  scalable: boolean;
};

/* -------- Page -------- */
export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<Settings | null>(null);

  // Inbox watching
  const [inbox, setInbox] = useState<InboxCfg>({ gmail: false, ms365: false, intervalMinutes: 10 });
  const [savingInbox, setSavingInbox] = useState(false);

  // Costs
  const [month, setMonth] = useState(firstOfMonthInput(new Date()));
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [savingCosts, setSavingCosts] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await ensureDemoAuth();
      if (!ok) return;
      try {
        const data = await apiFetch<Settings>("/tenant/settings");
        setS({
          ...data,
          links: (data.links as any) ?? [],
          questionnaire: (data.questionnaire as any) ?? defaultQuestions(),
        });
        const inboxCfg = await apiFetch<InboxCfg>("/tenant/inbox");
        setInbox(inboxCfg);
      } catch (e: any) {
        toast({ title: "Failed to load settings", description: e?.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  // load costs for selected month range (we’ll show current month only to keep simple)
  useEffect(() => {
    (async () => {
      try {
        const from = month; // first-of-month
        // next month exclusive
        const to = firstOfMonthInput(addMonths(new Date(month), 1));
        const rows = await apiFetch<CostRow[]>(
          `/tenant/costs?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );
        setCosts(rows);
      } catch {
        setCosts([]);
      }
    })();
  }, [month]);

  async function saveBrand() {
    if (!s) return;
    try {
      const updated = await apiFetch<Settings>("/tenant/settings", {
        method: "PUT",
        json: { ...s, links: s.links ?? [], questionnaire: s.questionnaire ?? [] },
      });
      setS({
        ...updated,
        links: (updated.links as any) ?? [],
        questionnaire: (updated.questionnaire as any) ?? [],
      });
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "unknown", variant: "destructive" });
    }
  }

  async function saveInboxCfg() {
    setSavingInbox(true);
    try {
      await apiFetch("/tenant/inbox", { method: "PUT", json: inbox });
      toast({ title: "Inbox watch updated" });
    } catch (e: any) {
      toast({ title: "Failed to save inbox settings", description: e?.message, variant: "destructive" });
    } finally {
      setSavingInbox(false);
    }
  }

  async function importNow(provider: "gmail" | "ms365") {
    try {
      await apiFetch("/" + (provider === "gmail" ? "gmail/import" : "ms365/import"), {
        method: "POST",
        json: provider === "gmail" ? { max: 25, q: "newer_than:30d" } : { max: 25 },
      });
      toast({ title: `Imported from ${provider.toUpperCase()}` });
    } catch (e: any) {
      toast({ title: `Import from ${provider.toUpperCase()} failed`, description: e?.message, variant: "destructive" });
    }
  }

  function upsertCost(row: Partial<CostRow>) {
    setSavingCosts(true);
    (async () => {
      try {
        const saved = await apiFetch<CostRow>("/tenant/costs", {
          method: "POST",
          json: {
            source: row.source,
            month: month, // always this selected month
            spend: Number(row.spend) || 0,
            leads: Number(row.leads) || 0,
            conversions: Number(row.conversions) || 0,
            scalable: !!row.scalable,
          },
        });
        // refresh list
        const from = month;
        const to = firstOfMonthInput(addMonths(new Date(month), 1));
        const rows = await apiFetch<CostRow[]>(
          `/tenant/costs?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );
        setCosts(rows);
        toast({ title: "Cost saved" });
      } catch (e: any) {
        toast({ title: "Save cost failed", description: e?.message, variant: "destructive" });
      } finally {
        setSavingCosts(false);
      }
    })();
  }

  async function removeCost(id: string) {
    setSavingCosts(true);
    try {
      await apiFetch(`/tenant/costs/${id}`, { method: "DELETE" });
      setCosts((c) => c.filter((r) => r.id !== id));
      toast({ title: "Row deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message, variant: "destructive" });
    } finally {
      setSavingCosts(false);
    }
  }

  if (loading || !s) return <div className="p-6 text-sm text-slate-600">Loading…</div>;

  return (
    <div className="max-w-4xl p-6 space-y-6">
      <h1 className="text-xl font-semibold mb-2">Company Settings</h1>

      <SourceCosts />

      {/* other content continues... */}
    </div>
  );
}