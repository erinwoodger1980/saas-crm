// web/src/components/SectionCard.tsx
export default function SectionCard({ title, action, children }:{
  title: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl2 border bg-white shadow-card">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b">
        <h2 className="text-sm font-semibold text-ink-700">{title}</h2>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}