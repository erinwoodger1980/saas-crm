import { ReactNode } from "react";
import clsx from "clsx";

const VARIANTS = {
  sky: {
    outer: "from-sky-100/70 via-white to-rose-100/60",
    blobA: "bg-sky-200/40",
    blobB: "bg-rose-200/40",
  },
  indigo: {
    outer: "from-indigo-100/70 via-white to-blue-100/60",
    blobA: "bg-indigo-200/40",
    blobB: "bg-blue-200/40",
  },
  amber: {
    outer: "from-amber-100/70 via-white to-rose-100/60",
    blobA: "bg-amber-200/40",
    blobB: "bg-rose-200/40",
  },
  violet: {
    outer: "from-fuchsia-100/70 via-white to-indigo-100/60",
    blobA: "bg-fuchsia-200/40",
    blobB: "bg-indigo-200/40",
  },
} as const;

export type DeskSurfaceVariant = keyof typeof VARIANTS;

type DeskSurfaceProps = {
  children: ReactNode;
  variant?: DeskSurfaceVariant;
  className?: string;
  innerClassName?: string;
};

export function DeskSurface({
  children,
  variant = "sky",
  className,
  innerClassName,
}: DeskSurfaceProps) {
  const tone = VARIANTS[variant] ?? VARIANTS.sky;

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-[36px] border border-white/50 bg-gradient-to-br shadow-[0_35px_80px_-45px_rgba(30,64,175,0.45)]",
        tone.outer,
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute -top-24 -left-28 h-64 w-64 rounded-full blur-3xl",
          tone.blobA,
        )}
      />
      <div
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full blur-3xl",
          tone.blobB,
        )}
      />

      <div className={clsx("relative z-10 space-y-6 p-6 sm:p-8", innerClassName)}>{children}</div>
    </div>
  );
}
