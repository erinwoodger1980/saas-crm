// web/src/components/StatusPill.tsx
const styles: Record<string,string> = {
  NEW_ENQUIRY: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  INFO_REQUESTED: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  READY_TO_QUOTE: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100",
  QUOTE_SENT: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
  WON: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  LOST: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
  DISQUALIFIED: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  CONTACTED: "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
  REJECTED: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};
export default function StatusPill({ label }: { label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${styles[label] || "bg-slate-100 text-slate-600"}`}>
      {label.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c=>c.toUpperCase())}
    </span>
  );
}