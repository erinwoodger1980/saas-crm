// Shared heading block for Wealden Joinery sections.
export function SectionHeading({ title, eyebrow, copy }: { title: string; eyebrow?: string; copy?: string }) {
  return (
    <div className="mb-6 space-y-2 text-left">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-900/80">{eyebrow}</p>
      ) : null}
      <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">{title}</h2>
      {copy ? <p className="text-base text-slate-600 md:text-lg">{copy}</p> : null}
    </div>
  );
}
