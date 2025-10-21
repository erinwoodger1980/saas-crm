"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

async function getJSON<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return (await res.json()) as T;
}

type TenantSettings = {
  brandName: string;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
};

type State = { tenant: TenantSettings | null; loading: boolean; error: string | null };

export default function QuestionnaireThankYouPage() {
  return (
    <Shell>
      <Suspense fallback={<LoadingCard />}>
        <ThankYouContent />
      </Suspense>
    </Shell>
  );
}

function ThankYouContent() {
  const params = useSearchParams();
  const slug = params.get("tenant")?.trim() || "";

  const [{ tenant, loading, error }, setState] = useState<State>({
    tenant: null,
    loading: !!slug,
    error: null,
  });

  useEffect(() => {
    if (!slug) {
      setState({ tenant: null, loading: false, error: null });
      return;
    }
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getJSON<TenantSettings & { tenantId: string }>(`/public/tenant/by-slug/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (!active) return;
        setState({ tenant: data, loading: false, error: null });
      })
      .catch((e: any) => {
        if (!active) return;
        setState({ tenant: null, loading: false, error: e?.message || "Failed to load brand" });
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const brandName = tenant?.brandName || "Our team";
  const websiteHref = tenant?.website || "/";

  if (loading) {
    return <LoadingCard />;
  }

  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-8 text-center shadow-[0_24px_70px_-35px_rgba(30,64,175,0.35)] backdrop-blur sm:p-10">
      {tenant?.logoUrl ? (
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
          <img src={tenant.logoUrl} alt={`${brandName} logo`} className="h-full w-full object-contain" />
        </div>
      ) : (
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-slate-200/70 bg-white text-sm font-semibold text-slate-400">
          {brandName.slice(0, 2).toUpperCase()}
        </div>
      )}

      <h1 className="text-3xl font-semibold text-slate-900">Thank you for sharing your project details</h1>
      <p className="mt-4 text-base text-slate-600">
        Someone from {brandName} will be in touch in the next few days with an estimate, or to ask any follow-up questions if we need a little more information.
      </p>
      {tenant?.phone ? (
        <p className="mt-3 text-sm text-slate-500">Prefer to chat? Call us on {tenant.phone}.</p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a
          href={websiteHref}
          className="inline-flex items-center gap-2 rounded-full bg-[rgb(var(--brand))] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
        >
          Return to {brandName}
        </a>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 px-6 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-white"
        >
          Close this page
        </button>
      </div>
    </section>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 px-6 py-8 text-center text-sm text-slate-600 shadow">
      Getting things ready…
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-[-10%] h-72 w-72 rounded-full bg-[rgb(var(--brand))/0.12] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-28 bottom-[-20%] h-80 w-80 rounded-full bg-indigo-200/20 blur-3xl" />
      <div className="relative mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        {children}
      </div>
    </div>
  );
}
