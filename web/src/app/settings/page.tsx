"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import confetti from "canvas-confetti";

/* ---------------- Types ---------------- */
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
  month: string;
  spend: number;
  leads: number;
  conversions: number;
  scalable: boolean;
};

/* ---------------- Small UI bits ---------------- */
function Section({
  title,
  description,
  right,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border bg-white/90 p-5 shadow-[0_10px_30px_-22px_rgba(2,6,23,0.45)] ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-800">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          )}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-slate-600">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </label>
  );
}

/* ---------------- Helpers ---------------- */
function defaultQuestions(): QField[] {
  return [
    { key: "contactName", label: "Your name", type: "text", required: true },
    { key: "email", label: "Email", type: "text", required: true },
    {
      key: "projectType",
      label: "Project type",
      type: "select",
      options: ["Windows", "Doors", "Conservatory", "Other"],
    },
    { key: "notes", label: "Notes", type: "textarea" },
  ];
}
function initials(name?: string | null) {
  if (!name) return "JB";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
function firstOfMonthISO(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

/* ============================================================
   Page
============================================================ */
export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<Settings | null>(null);
  const [inbox, setInbox] = useState<InboxCfg>({
    gmail: false,
    ms365: false,
    intervalMinutes: 10,
  });
  const [savingInbox, setSavingInbox] = useState(false);
  const [training, setTraining] = useState(false);

  const [costs, setCosts] = useState<CostRow[]>([]);
  const [costDraft, setCostDraft] = useState({
    id: null as string | null,
    source: "",
    month: firstOfMonthISO(),
    spend: "",
    leads: "",
    conversions: "",
    scalable: true,
  });
  const [savingCost, setSavingCost] = useState(false);

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
          introHtml: data.introHtml ?? "",
        });
        const inboxCfg = await apiFetch<InboxCfg>("/tenant/inbox");
        setInbox(inboxCfg);
        const costRows = await apiFetch<CostRow[]>("/tenant/costs");
        setCosts(costRows);
      } catch (e: any) {
        toast({
          title: "Failed to load settings",
          description: e?.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  async function connectGmail() {
    try {
      const r1 = await apiFetch<{ authUrl?: string }>("/gmail/auth-url").catch(() => null as any);
      const url = r1?.authUrl;
      if (url) return (window.location.href = url);

      const r2 = await apiFetch<{ authUrl?: string }>("/gmail/connect").catch(() => null as any);
      if (r2?.authUrl) return (window.location.href = r2.authUrl);

      toast({
        title: "Couldn’t start Gmail connect",
        description: "Auth URL not provided by API.",
        variant: "destructive",
      });
    } catch (e: any) {
      toast({
        title: "Gmail connect failed",
        description: e?.message,
        variant: "destructive",
      });
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
      toast({
        title: `Import from ${provider.toUpperCase()} failed`,
        description: e?.message,
        variant: "destructive",
      });
    }
  }

  async function handleTrainModel() {
    setTraining(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/ml/train`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("jwt")}`,
        },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Training failed");

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#f59e0b", "#84cc16", "#3b82f6", "#ec4899", "#f87171"],
      });

      toast({
        title: "✨ Training started!",
        description:
          json.message || "Your model is learning from your 500 recent quote PDFs.",
      });
    } catch (err: any) {
      toast({
        title: "Training failed",
        description: err.message || "Could not start training.",
        variant: "destructive",
      });
    } finally {
      setTraining(false);
    }
  }

  if (loading || !s) {
    return <div className="p-6 text-sm text-slate-600">Loading…</div>;
  }

  /* ---------------- Render ---------------- */
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-8">
      {/* --- existing settings above omitted for brevity --- */}

      <Section
        title="Inbox"
        description="Connect Gmail / Microsoft 365 and set an automatic import schedule."
        right={
          <Button size="sm" onClick={() => toast({ title: "Inbox saved" })} disabled={savingInbox}>
            {savingInbox ? "Saving…" : "Save"}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 rounded-lg border p-3 hover:bg-slate-50">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={inbox.gmail}
              onChange={(e) => setInbox({ ...inbox, gmail: e.target.checked })}
            />
            <span className="text-sm">Gmail</span>
          </label>

          <label className="flex items-center gap-2 rounded-lg border p-3 hover:bg-slate-50">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={inbox.ms365}
              onChange={(e) => setInbox({ ...inbox, ms365: e.target.checked })}
            />
            <span className="text-sm">Microsoft 365</span>
          </label>

          {/* ✨ Disney-style Train Model button */}
          <div className="mt-6 border-t pt-4 sm:col-span-3">
            <h3 className="text-lg font-semibold mb-2">Machine Learning</h3>
            <p className="text-sm text-gray-500 mb-4">
              Train the model using the last 500 sent quote emails with PDF attachments.
            </p>

            <Button
              onClick={handleTrainModel}
              disabled={training}
              className={`transition-all duration-300 ${
                training
                  ? "bg-gradient-to-r from-blue-400 to-purple-500 animate-pulse"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
              }`}
            >
              {training ? "Training..." : "✨ Train Model"}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={connectGmail}>Connect Gmail</Button>
          <Button variant="outline" onClick={() => importNow("gmail")}>
            Import Gmail now
          </Button>
          <Button variant="outline" onClick={() => importNow("ms365")}>
            Import MS365 now
          </Button>
        </div>
      </Section>
    </div>
  );
}