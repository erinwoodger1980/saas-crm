// web/src/components/Sparkline.tsx
"use client";
export default function Sparkline({
  values,
  width = 120,
  height = 28,
  strokeWidth = 2,
  title,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  title?: string;
}) {
  if (!values.length) return <div className="text-xs text-slate-400">—</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const pts = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / span) * height;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-label={title}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        points={pts.join(" ")}
      />
    </svg>
  );
}