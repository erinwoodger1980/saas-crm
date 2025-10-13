// web/src/components/LeadCard.tsx
import StatusPill from "./StatusPill";
import { Mail, Clock, Building2 } from "lucide-react";

export function LeadCard({ lead, onClick }:{ lead: any; onClick?: ()=>void }) {
  return (
    <div
      onClick={onClick}
      className="group rounded-xl border bg-white p-4 shadow-soft hover:shadow-card transition cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-100 to-white grid place-items-center text-sm font-semibold text-brand-700 border">
          {avatarText(lead.contactName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate font-medium text-ink-700">{lead.contactName || "Lead"}</div>
            <StatusPill label={(lead.custom?.uiStatus || lead.status)?.toString().toUpperCase()} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-300">
            {lead.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5"/>{lead.email}</span>}
            {lead.custom?.source && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5"/>{lead.custom.source}</span>}
            {lead.nextAction && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5"/>{lead.nextAction}</span>}
          </div>
          {lead.custom?.summary && (
            <p className="mt-2 line-clamp-2 text-[13px] text-ink-500">{lead.custom.summary}</p>
          )}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition text-[11px] text-ink-300">Open ›</div>
      </div>
    </div>
  );
}
function avatarText(name?: string|null) {
  if (!name) return "•";
  const p = name.trim().split(/\s+/);
  return (p[0][0] + (p[1]?.[0] || "")).toUpperCase();
}