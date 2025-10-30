"use client";

import React from "react";

type GaugeProps = {
  value: number; // 0..1
  size?: number; // px
  strokeWidth?: number; // px
  label?: string;
  caption?: string;
  color?: string; // tailwind color hex or any css color
};

export function Gauge({ value, size = 120, strokeWidth = 12, label, caption, color = "#0ea5e9" }: GaugeProps) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - v);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="fill-slate-800"
          style={{ fontSize: size * 0.22, fontWeight: 700 }}
        >
          {Math.round(v * 100)}%
        </text>
      </svg>
      {label && <div className="mt-2 text-sm font-medium text-slate-800">{label}</div>}
      {caption && <div className="text-xs text-slate-500">{caption}</div>}
    </div>
  );
}

export default Gauge;
