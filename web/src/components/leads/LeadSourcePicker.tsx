// web/src/components/leads/LeadSourcePicker.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

type SourceInfo = {
  source: string;
  month: string;  // ISO
  spend: number;
  leads: number;
  conversions: number;
  cpl: number | null;
  cps: number | null;
};

const CUSTOM = "__custom__";
const NONE   = "__none__";

export default function LeadSourcePicker({
  leadId,
  value,
  onSaved,
  className,
}: {
  leadId: string;
  value?: string | null;
  onSaved?: (next: string | null) => void;
  className?: string;
}) {
  const { toast } = useToast();
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [saving, setSaving] = useState(false);

  // local UI state
  const [selectVal, setSelectVal] = useState<string>(NONE);
  const [customVal, setCustomVal] = useState<string>("");

  /* Load available sources from costs */
  useEffect(() => {
    (async () => {
      try {
        const rows = await apiFetch<SourceInfo[]>("/source-costs/sources");
        // sort alpha by name for nicer UX
        setSources([...rows].sort((a, b) => a.source.localeCompare(b.source)));
      } catch (e: any) {
        toast({
          title: "Couldn’t load sources",
          description: String(e?.message || e),
          variant: "destructive",
        });
      }
    })();
  }, [toast]);

  /* Seed initial selection */
  useEffect(() => {
    const current = (value || "").trim();
    if (!current) {
      setSelectVal(NONE);
      setCustomVal("");
      return;
    }

    const exists = sources.some(
      (s) => s.source.trim().toLowerCase() === current.toLowerCase()
    );

    if (exists) {
      setSelectVal(current);
      setCustomVal("");
    } else {
      setSelectVal(CUSTOM);
      setCustomVal(current);
    }
  }, [value, sources]);

  const selectedInfo = useMemo(() => {
    const needle =
      selectVal === CUSTOM ? customVal.trim().toLowerCase() : selectVal.trim().toLowerCase();
    if (!needle) return null;
    return (
      sources.find((s) => s.source.trim().toLowerCase() === needle) || null
    );
  }, [sources, selectVal, customVal]);

  async function save(next: string | null) {
    // Avoid unnecessary writes if not changed
    const current = (value || "").trim();
    const nextTrim = (next || "").trim();
    if (current === nextTrim) return;

    setSaving(true);
    try {
      await apiFetch(`/leads/${encodeURIComponent(leadId)}`, {
        method: "PATCH",
        json: { custom: { source: nextTrim || null } },
      });
      onSaved?.(nextTrim || null);
      toast({
        title: "Lead source updated",
        description: nextTrim ? nextTrim : "Cleared",
      });
    } catch (e: any) {
      toast({
        title: "Failed to update lead source",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function onSelectChange(v: string) {
    setSelectVal(v);
    if (v === CUSTOM) return;        // wait for custom input save
    if (v === NONE) { save(null); return; }
    save(v);
  }

  function onCustomSubmit() {
    const v = customVal.trim();
    if (!v) {
      setSelectVal(NONE);
      save(null);
      return;
    }
    save(v);
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          value={selectVal}
          onChange={(e) => onSelectChange(e.target.value)}
          disabled={saving}
        >
          <option value={NONE}>Select source…</option>
          {sources.map((s) => (
            <option key={s.source} value={s.source}>
              {s.source}
            </option>
          ))}
          <option value={CUSTOM}>Custom…</option>
        </select>

        {selectVal === CUSTOM && (
          <div className="flex w-full gap-2">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Type source name"
              value={customVal}
              onChange={(e) => setCustomVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCustomSubmit();
              }}
              disabled={saving}
            />
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onClick={onCustomSubmit}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* Inline metrics for the selected/typed source (if we have cost data) */}
      {selectedInfo ? (
        <div className="mt-1 text-xs text-slate-600">
          Latest: <strong>{new Date(selectedInfo.month).toLocaleDateString()}</strong>
          {" · "}Spend £{selectedInfo.spend.toFixed(0)}
          {" · "}Leads {selectedInfo.leads}
          {" · "}Sales {selectedInfo.conversions}
          {" · "}CPL{" "}
          {selectedInfo.cpl != null ? `£${selectedInfo.cpl.toFixed(0)}` : "–"}
          {" · "}CPS{" "}
          {selectedInfo.cps != null ? `£${selectedInfo.cps.toFixed(0)}` : "–"}
        </div>
      ) : selectVal !== NONE && (selectVal === CUSTOM ? customVal.trim() : selectVal) ? (
        <div className="mt-1 text-xs text-slate-500">
          No cost data yet for{" "}
          <strong>{selectVal === CUSTOM ? customVal.trim() : selectVal}</strong>.
        </div>
      ) : null}
    </div>
  );
}