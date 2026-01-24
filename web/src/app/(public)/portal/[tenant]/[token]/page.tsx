'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_BASE } from '@/lib/api';

type PortalData = {
  ok: boolean;
  portalUrl?: string;
  tenant: {
    id: string;
    slug: string;
    name: string;
    logoUrl?: string | null;
    heroImageUrl?: string | null;
    galleryImageUrls?: string[] | null;
    reviewCount?: number | null;
    reviewScore?: any;
    reviewSourceLabel?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    website?: string | null;
    phone?: string | null;
    links?: any;
    quoteDefaults?: any;
    testimonials?: any;
  };
  client: {
    id: string | null;
    source: 'client' | 'lead';
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    postcode: string | null;
    country: string | null;
  };
  quote: {
    id: string;
    title: string;
    status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | string;
    currency: string;
    totalGBP: any;
    proposalFileId?: string | null;
    meta?: any;
    lines?: Array<{
      id: string;
      description?: string | null;
      qty?: number | null;
      unitPrice?: number | null;
      currency?: string | null;
      meta?: any;
      lineStandard?: any;
      sortIndex?: number | null;
    }>;
  };
  quotes: Array<{
    id: string;
    title: string;
    status: string;
    totalGBP: any;
    currency: string;
    createdAt: string;
    updatedAt: string;
  }>;
  orders: Array<{
    id: string;
    title: string;
    stage: string;
    startDate: string | null;
    deliveryDate: string | null;
    installationStartDate: string | null;
    installationEndDate: string | null;
    timberOrderedAt: string | null;
    timberExpectedAt: string | null;
    timberReceivedAt: string | null;
    timberNotApplicable: boolean;
    glassOrderedAt: string | null;
    glassExpectedAt: string | null;
    glassReceivedAt: string | null;
    glassNotApplicable: boolean;
    ironmongeryOrderedAt: string | null;
    ironmongeryExpectedAt: string | null;
    ironmongeryReceivedAt: string | null;
    ironmongeryNotApplicable: boolean;
    paintOrderedAt: string | null;
    paintExpectedAt: string | null;
    paintReceivedAt: string | null;
    paintNotApplicable: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  invoices: Array<{
    id: string;
    provider: string;
    externalType: string;
    documentNumber: string | null;
    referenceText: string | null;
    contactName: string | null;
    currency: string;
    total: any;
    net: any;
    tax: any;
    issueDate: string | null;
    dueDate: string | null;
    status: string | null;
  }>;
};

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCurrency(value: number, currency?: string | null) {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(value);
  } catch {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
  }
}

function getSellUnit(line: any): number | null {
  const meta: any = line?.meta || {};
  return normalizeNumber(meta.sellUnitGBP ?? meta.sell_unit ?? line?.sellUnit);
}

function getSellTotal(line: any): number | null {
  const meta: any = line?.meta || {};
  const direct = normalizeNumber(meta.sellTotalGBP ?? meta.sell_total ?? line?.sellTotal);
  if (direct != null) return direct;
  const unit = getSellUnit(line);
  const qty = normalizeNumber(line?.qty) ?? 1;
  return unit != null ? unit * qty : null;
}

function firstUrlFromLinks(links: any): string | null {
  if (!links || typeof links !== 'object') return null;
  const candidates = [
    links.bookingUrl,
    links.bookAppointmentUrl,
    links.appointmentUrl,
    links.showroomBookingUrl,
    links.showroomUrl,
  ].filter((v) => typeof v === 'string' && v.trim());
  if (candidates.length) return String(candidates[0]).trim();
  return null;
}

function normalizeSortIndex(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeGuarantees(raw: any): Array<{ title: string; description?: string | null }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g) => {
      if (typeof g === 'string') {
        const t = g.trim();
        return t ? { title: t } : null;
      }
      if (g && typeof g === 'object') {
        const title = String((g as any).title ?? (g as any).name ?? (g as any).label ?? '').trim();
        const description = String((g as any).description ?? (g as any).detail ?? (g as any).text ?? '').trim();
        if (!title && !description) return null;
        return { title: title || description, description: title ? (description || null) : null };
      }
      return null;
    })
    .filter(Boolean) as Array<{ title: string; description?: string | null }>;
}

function normalizeTestimonials(raw: any): Array<{ quote: string; client: string; role?: string; photoUrl?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => {
      if (typeof t === 'string') {
        const q = t.trim();
        return q ? { quote: q, client: '' } : null;
      }
      if (t && typeof t === 'object') {
        const quote = String((t as any).quote ?? (t as any).text ?? '').trim();
        const client = String((t as any).client ?? (t as any).name ?? '').trim();
        const role = String((t as any).role ?? '').trim();
        const photoUrl = String((t as any).photoUrl ?? (t as any).photoDataUrl ?? '').trim();
        if (!quote && !client) return null;
        return { quote: quote || client, client: quote ? client : '', role: role || undefined, photoUrl: photoUrl || undefined };
      }
      return null;
    })
    .filter(Boolean) as Array<{ quote: string; client: string; role?: string; photoUrl?: string }>;
}

function normalizeCertifications(
  raw: any,
): Array<{ name: string; description?: string | null; logoUrl?: string | null; href?: string | null }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const name = String((c as any).name ?? (c as any).title ?? (c as any).label ?? '').trim();
      const description = String((c as any).description ?? (c as any).detail ?? '').trim();
      const logoUrl = String(
        (c as any).logoUrl ?? (c as any).imageUrl ?? (c as any).image ?? (c as any).logo ?? '',
      ).trim();
      const href = String((c as any).href ?? (c as any).url ?? (c as any).link ?? '').trim();
      if (!name && !description && !logoUrl) return null;
      return {
        name: name || description || 'Certification',
        description: name ? (description || null) : null,
        logoUrl: logoUrl || null,
        href: href || null,
      };
    })
    .filter(Boolean) as Array<{ name: string; description?: string | null; logoUrl?: string | null; href?: string | null }>;
}

export default function QuotePortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [activeTab, setActiveTab] = useState<'client' | 'product' | 'quote'>('client');
  const moodboardInputRef = useRef<HTMLInputElement | null>(null);

  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postcode: '',
    country: '',
    notes: '',
  });

  const [lineDrafts, setLineDrafts] = useState<Record<string, { description: string; qty: string }>>({});

  const bookingUrl = useMemo(() => firstUrlFromLinks(data?.tenant?.links), [data?.tenant?.links]);

  const fileUrl = useCallback(
    (fileId: string) => `${API_BASE}/files/${encodeURIComponent(fileId)}?jwt=${encodeURIComponent(token)}`,
    [token],
  );

  const christchurchCertificationLogos = useMemo(() => {
    const cc: any = data?.quote?.meta?.proposalChristchurchImageFileIds || {};

    const candidates: Array<{ key: string; name: string }> = [
      { key: 'fensaFileId', name: 'FENSA' },
      { key: 'pas24FileId', name: 'PAS 24' },
      { key: 'fscFileId', name: 'FSC' },
      { key: 'ggfFileId', name: 'GGF' },
      { key: 'badge1FileId', name: 'Accreditation' },
      { key: 'badge2FileId', name: 'Accreditation' },
    ];

    const picked = candidates
      .map((c) => {
        const fileId = String(cc?.[c.key] || '').trim();
        if (!fileId) return null;
        return {
          name: c.name,
          logoUrl: fileUrl(fileId),
          href: null as string | null,
          description: null as string | null,
        };
      })
      .filter(Boolean) as Array<{ name: string; logoUrl: string; href: string | null; description: string | null }>;

    // Remove duplicates if multiple keys point to same fileId.
    const seen = new Set<string>();
    const deduped: typeof picked = [];
    for (const item of picked) {
      if (seen.has(item.logoUrl)) continue;
      seen.add(item.logoUrl);
      deduped.push(item);
    }

    return deduped;
  }, [data?.quote?.meta, fileUrl]);

  const quoteLines = useMemo(
    () => (data?.quote?.lines && Array.isArray(data.quote.lines) ? data.quote.lines : []),
    [data?.quote?.lines],
  );

  const sortedQuoteLines = useMemo(() => {
    const copy = [...quoteLines];
    copy.sort((a: any, b: any) => {
      const ai = normalizeSortIndex(a?.sortIndex);
      const bi = normalizeSortIndex(b?.sortIndex);
      if (ai !== bi) return ai - bi;
      const ad = String(a?.description ?? '').toLowerCase();
      const bd = String(b?.description ?? '').toLowerCase();
      if (ad !== bd) return ad.localeCompare(bd);
      return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
    });
    return copy;
  }, [quoteLines]);
  const moodboardFileIds = useMemo(() => {
    const ids: any = data?.quote?.meta?.customerMoodboardFileIds;
    return Array.isArray(ids) ? (ids.filter((x) => typeof x === 'string' && x.trim()) as string[]) : [];
  }, [data?.quote?.meta]);

  const totals = useMemo(() => {
    const currency = data?.quote?.currency || 'GBP';
    const sellTotal = sortedQuoteLines.reduce((sum, ln) => sum + (getSellTotal(ln) ?? 0), 0);
    return { currency, sellTotal: Number.isFinite(sellTotal) ? Math.round(sellTotal * 100) / 100 : 0 };
  }, [sortedQuoteLines, data?.quote?.currency]);

  const refreshPortal = useCallback(async () => {
    const r = await fetch(`${API_BASE}/public/quote-portal/${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`Failed to load portal (${r.status})`);
    const json = (await r.json()) as PortalData;
    setData(json);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`${API_BASE}/public/quote-portal/${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`Failed to load portal (${r.status})`);
        const json = (await r.json()) as PortalData;
        if (cancelled) return;
        setData(json);
        setClientForm({
          name: json.client?.name || '',
          email: json.client?.email || '',
          phone: json.client?.phone || '',
          address: json.client?.address || '',
          city: json.client?.city || '',
          postcode: json.client?.postcode || '',
          country: json.client?.country || '',
          notes: '',
        });
      } catch (e: any) {
        if (cancelled) return;
        setError(String(e?.message || 'Failed to load portal'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const next: Record<string, { description: string; qty: string }> = {};
    for (const ln of sortedQuoteLines) {
      next[ln.id] = {
        description: String(ln.description ?? '').trim(),
        qty: String(typeof ln.qty === 'number' ? ln.qty : (ln.qty == null ? 1 : Number(ln.qty) || 1)),
      };
    }
    setLineDrafts(next);
  }, [data?.quote?.id, sortedQuoteLines.length]);

  const handleUpdateLine = async (lineId: string, patch: { description?: string; qty?: number }) => {
    try {
      setError(null);
      const r = await fetch(`${API_BASE}/public/quote-portal/${encodeURIComponent(token)}/lines/${encodeURIComponent(lineId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
      );
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || j?.message || 'Failed to save line item');
      await refreshPortal();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to save line item'));
    }
  };

  const handleUploadLinePhoto = async (lineId: string, file: File) => {
    try {
      setError(null);
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${API_BASE}/public/quote-portal/${encodeURIComponent(token)}/lines/${encodeURIComponent(lineId)}/photo`, {
        method: 'POST',
        body: fd,
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || j?.message || 'Failed to upload photo');
      await refreshPortal();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to upload photo'));
    }
  };

  const handleUploadMoodboard = async (files: FileList | null) => {
    if (!files || !files.length) return;
    try {
      setError(null);
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('files', f));
      const r = await fetch(`${API_BASE}/public/quote-portal/${encodeURIComponent(token)}/moodboard`, {
        method: 'POST',
        body: fd,
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || j?.message || 'Failed to upload moodboard');
      await refreshPortal();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to upload moodboard'));
    } finally {
      if (moodboardInputRef.current) moodboardInputRef.current.value = '';
    }
  };

  const handleShare = async () => {
    const url = data?.portalUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  const handleSaveClient = async () => {
    try {
      setError(null);
      const r = await fetch(`${API_BASE}/public/quote-portal/${encodeURIComponent(token)}/client`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clientForm.name,
          email: clientForm.email,
          phone: clientForm.phone,
          address: clientForm.address,
          city: clientForm.city,
          postcode: clientForm.postcode,
          country: clientForm.country,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message || 'Failed to save details');
      // refresh
      const refreshed = await fetch(`${API_BASE}/public/quote-portal/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const refreshedJson = (await refreshed.json()) as PortalData;
      setData(refreshedJson);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to save details'));
    }
  };

  const handleAcceptQuote = async () => {
    if (!data?.quote?.id) return;
    const ok = window.confirm('Confirm acceptance of this quote?');
    if (!ok) return;
    try {
      setError(null);
      const r = await fetch(`${API_BASE}/public/quote-portal/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clientForm.name || data.client?.name || undefined,
          email: clientForm.email || data.client?.email || undefined,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message || 'Failed to accept quote');
      const refreshed = await fetch(`${API_BASE}/public/quote-portal/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const refreshedJson = (await refreshed.json()) as PortalData;
      setData(refreshedJson);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to accept quote'));
    }
  };

  // Derived UI data must be defined before any early returns to keep hook order stable.
  const guarantees = useMemo(
    () => normalizeGuarantees(data?.tenant?.quoteDefaults?.guarantees),
    [data?.tenant?.quoteDefaults?.guarantees],
  );
  const testimonials = useMemo(() => {
    const fromQuoteDefaults = normalizeTestimonials(data?.tenant?.quoteDefaults?.testimonials);
    if (fromQuoteDefaults.length) return fromQuoteDefaults;
    return normalizeTestimonials(data?.tenant?.testimonials);
  }, [data?.tenant?.quoteDefaults?.testimonials, data?.tenant?.testimonials]);
  const certifications = useMemo(() => {
    return normalizeCertifications(data?.tenant?.quoteDefaults?.certifications);
  }, [data?.tenant?.quoteDefaults?.certifications]);

  const certificationLogos = useMemo(
    () => {
      if (christchurchCertificationLogos.length) return christchurchCertificationLogos.slice(0, 8);
      return certifications.filter((c) => typeof c.logoUrl === 'string' && c.logoUrl.trim()).slice(0, 8);
    },
    [certifications, christchurchCertificationLogos],
  );

  const certificationLabels = useMemo(
    () => {
      // If Christchurch uploaded logos exist, prefer the logo strip only.
      if (christchurchCertificationLogos.length) return [];
      return certifications.filter((c) => !c.logoUrl).slice(0, 8);
    },
    [certifications, christchurchCertificationLogos],
  );

  const heroUrl = useMemo(() => {
    const url = String(data?.tenant?.heroImageUrl || '').trim();
    return url || null;
  }, [data?.tenant?.heroImageUrl]);

  const galleryUrls = useMemo(() => {
    const raw = data?.tenant?.galleryImageUrls;
    return Array.isArray(raw) ? raw.filter((u) => typeof u === 'string' && u.trim()) : [];
  }, [data?.tenant?.galleryImageUrls]);

  const effectiveHeroUrl = useMemo(() => {
    if (heroUrl) return heroUrl;
    if (galleryUrls.length) return galleryUrls[0];
    return null;
  }, [heroUrl, galleryUrls]);

  const galleryPreviewUrls = useMemo(() => {
    const filtered = galleryUrls.filter((u) => u !== effectiveHeroUrl);
    return filtered.slice(0, 3);
  }, [galleryUrls, effectiveHeroUrl]);

  const reviewScore = useMemo(() => normalizeNumber(data?.tenant?.reviewScore), [data?.tenant?.reviewScore]);
  const reviewCount = useMemo(() => normalizeNumber(data?.tenant?.reviewCount), [data?.tenant?.reviewCount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="text-sm text-muted-foreground">Loading…</div>
        </div>
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h1 className="text-xl font-semibold">Portal</h1>
          <p className="mt-2 text-sm text-destructive">{error || 'This link is invalid or expired.'}</p>
          <div className="mt-8 text-xs text-muted-foreground">Powered by joineryai.app</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-muted/50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="relative overflow-hidden rounded-3xl border bg-background/60 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/40">
          <div className="relative h-56 w-full md:h-80">
            {effectiveHeroUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={effectiveHeroUrl} alt="" className="h-full w-full object-cover" />
              </>
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/20 via-muted/10 to-background" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />

            {!effectiveHeroUrl ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-2xl border bg-background/70 px-4 py-3 text-xs text-muted-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/50">
                  Add photos in Product details to personalize this quote.
                </div>
              </div>
            ) : null}
          </div>

          <div className={effectiveHeroUrl ? 'absolute inset-x-0 bottom-0' : 'absolute inset-x-0 bottom-0'}>
            <div className={effectiveHeroUrl ? 'px-4 pb-5' : 'px-4 pb-5'}>
              <div className={
                effectiveHeroUrl
                  ? 'mx-auto max-w-5xl rounded-2xl border bg-background/85 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70 md:p-5'
                  : 'mx-auto max-w-5xl rounded-2xl border bg-background/85 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70 md:p-5'
              }>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    {data.tenant.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.tenant.logoUrl}
                        alt={data.tenant.name}
                        className="h-11 w-auto max-w-[200px] object-contain"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <div className="text-xl font-semibold leading-tight md:text-2xl">{data.tenant.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {data.tenant.website ? (
                          <a className="underline" href={data.tenant.website} target="_blank" rel="noreferrer">
                            {data.tenant.website}
                          </a>
                        ) : null}
                        {data.tenant.website && data.tenant.phone ? <span> · </span> : null}
                        {data.tenant.phone || null}
                        {reviewScore != null || reviewCount != null ? <span> · </span> : null}
                        {reviewScore != null ? <span>{reviewScore.toFixed(1)}★</span> : null}
                        {reviewCount != null ? <span>{reviewScore != null ? ' ' : ''}({Math.round(reviewCount)} reviews)</span> : null}
                        {data.tenant.reviewSourceLabel ? <span>{` · ${String(data.tenant.reviewSourceLabel)}`}</span> : null}
                      </div>
                      {data.tenant.quoteDefaults?.tagline ? (
                        <div className="mt-1 text-sm text-muted-foreground">{String(data.tenant.quoteDefaults.tagline)}</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {bookingUrl ? (
                      <Button asChild variant="outline">
                        <a href={bookingUrl} target="_blank" rel="noreferrer">Book an appointment</a>
                      </Button>
                    ) : null}
                    <Button variant="outline" onClick={handleShare} disabled={!data.portalUrl}>
                      Share
                    </Button>
                    {data.quote.status !== 'ACCEPTED' ? (
                      <Button onClick={handleAcceptQuote}>Accept quote</Button>
                    ) : (
                      <Button variant="secondary" disabled>Accepted</Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {(certificationLogos.length || certificationLabels.length || guarantees.length) ? (
            <div className={
              effectiveHeroUrl
                ? 'border-t bg-background/70 px-5 py-4'
                : 'border-t bg-background/60 px-5 py-4'
            }>
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Accreditations & guarantees</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {certificationLogos.map((c, idx) => {
                      const img = (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={String(c.logoUrl)}
                          alt={c.name}
                          className="h-9 w-auto max-w-[140px] object-contain"
                        />
                      );
                      return (
                        <div key={`logo-${idx}`} className="rounded-xl border bg-background/90 px-3 py-2 shadow-sm">
                          {c.href ? (
                            <a href={String(c.href)} target="_blank" rel="noreferrer" className="block">
                              {img}
                            </a>
                          ) : (
                            img
                          )}
                        </div>
                      );
                    })}

                    {certificationLabels.map((c, idx) => (
                      <div
                        key={`label-${idx}`}
                        className="rounded-full border bg-background/90 px-3 py-1 text-xs text-muted-foreground"
                        title={c.description || undefined}
                      >
                        {c.name}
                      </div>
                    ))}
                  </div>
                </div>

                {guarantees.length ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {guarantees.slice(0, 3).map((g, idx) => (
                      <div key={`g-chip-${idx}`} className="rounded-full border bg-background/90 px-3 py-1 text-xs">
                        {g.title}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </header>

        <div className="mt-6 grid gap-4 md:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-3xl border bg-background/70 p-5 shadow-sm">
            <div className="text-xs font-medium text-muted-foreground">Your quote</div>
            <div className="mt-1 text-xl font-semibold leading-tight md:text-2xl">{data.quote.title}</div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Status: {data.quote.status}</span>
              <span>·</span>
              <span>Pricing is read‑only</span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-2xl font-semibold md:text-3xl">{formatCurrency(totals.sellTotal, totals.currency)}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {data.quote.status !== 'ACCEPTED' ? 'Ready to proceed?' : 'Accepted'}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-background/70 p-3 shadow-sm">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 overflow-hidden rounded-2xl border bg-muted/20">
                {galleryUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={galleryUrls[0]} alt="Gallery" className="aspect-[16/11] h-full w-full object-cover" />
                ) : (
                  <div className="flex aspect-[16/11] flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                    <ImageIcon className="h-5 w-5" />
                    <div>Project gallery</div>
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                {galleryPreviewUrls.length ? (
                  galleryPreviewUrls.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt="Gallery" className="aspect-square w-full rounded-2xl border object-cover" />
                  ))
                ) : (
                  <>
                    <div className="flex aspect-square items-center justify-center rounded-2xl border bg-muted/20 text-xs text-muted-foreground">Details</div>
                    <div className="flex aspect-square items-center justify-center rounded-2xl border bg-muted/20 text-xs text-muted-foreground">Materials</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mt-8">
          <TabsList className="grid w-full grid-cols-3 rounded-2xl border bg-background/70 p-1 shadow-sm">
            <TabsTrigger value="client">Client details</TabsTrigger>
            <TabsTrigger value="product">Product details</TabsTrigger>
            <TabsTrigger value="quote">Quote details</TabsTrigger>
          </TabsList>

          <TabsContent value="client" className="mt-6 grid gap-6">
            <section className="rounded-3xl border bg-background/70 p-5 shadow-sm">
              <div className="text-sm font-medium">Your details</div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Name</div>
                  <Input value={clientForm.name} onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <Input value={clientForm.email} onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <Input value={clientForm.phone} onChange={(e) => setClientForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Postcode</div>
                  <Input value={clientForm.postcode} onChange={(e) => setClientForm((p) => ({ ...p, postcode: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-muted-foreground">Address</div>
                  <Textarea value={clientForm.address} onChange={(e) => setClientForm((p) => ({ ...p, address: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">City</div>
                  <Input value={clientForm.city} onChange={(e) => setClientForm((p) => ({ ...p, city: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Country</div>
                  <Input value={clientForm.country} onChange={(e) => setClientForm((p) => ({ ...p, country: e.target.value }))} />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">Source: {data.client.source}</div>
                <Button onClick={handleSaveClient}>Save details</Button>
              </div>
              {error ? <div className="mt-3 text-xs text-destructive">{error}</div> : null}
            </section>

            {(data.tenant.quoteDefaults?.guarantees?.length || data.tenant.testimonials?.length) ? (
              <section className="rounded-3xl border bg-background/70 p-5 shadow-sm">
                <div className="text-sm font-medium">Peace of mind</div>
                {(guarantees.length || certifications.length) ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {guarantees.slice(0, 10).map((g, idx) => (
                      <div key={`g-${idx}`} className="rounded-2xl border bg-background/90 p-4 shadow-sm">
                        <div className="text-sm font-medium">{g.title}</div>
                        {g.description ? <div className="mt-1 text-sm text-muted-foreground">{g.description}</div> : null}
                      </div>
                    ))}
                    {certifications.slice(0, 6).map((c: any, idx: number) => (
                      <div key={`c-${idx}`} className="rounded-2xl border bg-background/90 p-4 shadow-sm">
                        <div className="text-sm font-medium">{String(c.name)}</div>
                        {c.description ? <div className="mt-1 text-sm text-muted-foreground">{String(c.description)}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {testimonials.length ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {testimonials.slice(0, 6).map((t, idx) => (
                      <div key={idx} className="rounded-2xl border bg-background/90 p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          {t.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={t.photoUrl} alt="" className="h-11 w-11 rounded-full border object-cover" />
                          ) : null}
                          <div className="min-w-0">
                            <div className="text-sm leading-relaxed">{t.quote}</div>
                            {(t.client || t.role) ? (
                              <div className="mt-2 text-xs text-muted-foreground">
                                — {t.client || 'Customer'}{t.role ? `, ${t.role}` : ''}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </TabsContent>

          <TabsContent value="product" className="mt-6 grid gap-6">
            <section className="rounded-3xl border bg-background/70 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Product details</div>
                  <div className="mt-1 text-xs text-muted-foreground">Update descriptions, quantities, and upload reference photos.</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={moodboardInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => void handleUploadMoodboard(e.target.files)}
                  />
                  <Button variant="outline" onClick={() => moodboardInputRef.current?.click()}>
                    Upload moodboard
                  </Button>
                </div>
              </div>

              {moodboardFileIds.length ? (
                <div className="mt-4 grid grid-cols-6 gap-2">
                  <div className="col-span-6 overflow-hidden rounded-2xl border bg-muted/20 md:col-span-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileUrl(moodboardFileIds[0])}
                      alt="Moodboard"
                      className="aspect-[16/11] h-full w-full object-cover"
                    />
                  </div>
                  <div className="col-span-6 grid grid-cols-3 gap-2 md:col-span-3 md:grid-cols-3">
                    {moodboardFileIds.slice(1, 7).map((fid) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={fid} src={fileUrl(fid)} alt="Moodboard" className="aspect-square w-full rounded-2xl border object-cover" />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 grid gap-4">
                {sortedQuoteLines.map((ln) => {
                  const draft = lineDrafts[ln.id] || { description: String(ln.description ?? ''), qty: String(ln.qty ?? 1) };
                  const photoId = ln.lineStandard?.photoOutsideFileId || ln.lineStandard?.photoFileId || null;
                  return (
                    <div key={ln.id} className="rounded-2xl border bg-background/90 p-4 shadow-sm">
                      <div className="grid gap-4 md:grid-cols-[120px_1fr]">
                        <div>
                          <div className="aspect-square w-full overflow-hidden rounded-2xl border bg-muted/30">
                            {photoId ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={fileUrl(String(photoId))} alt="Item photo" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No photo</div>
                            )}
                          </div>
                          <div className="mt-2">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleUploadLinePhoto(ln.id, f);
                                e.currentTarget.value = '';
                              }}
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <div className="text-xs text-muted-foreground">Description</div>
                            <Textarea
                              value={draft.description}
                              onChange={(e) => setLineDrafts((p) => ({ ...p, [ln.id]: { ...draft, description: e.target.value } }))}
                              onBlur={() => {
                                const next = String((lineDrafts[ln.id]?.description ?? draft.description) || '').trim();
                                if (next && next !== String(ln.description ?? '').trim()) {
                                  void handleUpdateLine(ln.id, { description: next });
                                }
                              }}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs text-muted-foreground">Quantity</div>
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={draft.qty}
                                onChange={(e) => setLineDrafts((p) => ({ ...p, [ln.id]: { ...draft, qty: e.target.value } }))}
                                onBlur={() => {
                                  const raw = lineDrafts[ln.id]?.qty ?? draft.qty;
                                  const q = Number(raw);
                                  const existing = typeof ln.qty === 'number' ? ln.qty : Number(ln.qty) || 1;
                                  if (Number.isFinite(q) && q > 0 && q !== existing) {
                                    void handleUpdateLine(ln.id, { qty: q });
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Notes</div>
                              <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">Pricing is shown in Quote details.</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {error ? <div className="mt-3 text-xs text-destructive">{error}</div> : null}
            </section>
          </TabsContent>

          <TabsContent value="quote" className="mt-6 grid gap-6">
            <section className="rounded-3xl border bg-background/70 p-5 shadow-sm">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Quote details</div>
                  <div className="mt-1 text-xs text-muted-foreground">Pricing is read-only.</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-xl font-semibold">{formatCurrency(totals.sellTotal, totals.currency)}</div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border bg-background/90 shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQuoteLines.map((ln) => {
                      const unit = getSellUnit(ln);
                      const total = getSellTotal(ln);
                      return (
                        <tr key={ln.id} className="border-t hover:bg-muted/20">
                          <td className="px-3 py-2 align-top">
                            <div className="font-medium">{String(ln.description || 'Item')}</div>
                          </td>
                          <td className="px-3 py-2 text-right align-top">{normalizeNumber(ln.qty) ?? 1}</td>
                          <td className="px-3 py-2 text-right align-top">{unit != null ? formatCurrency(unit, totals.currency) : '—'}</td>
                          <td className="px-3 py-2 text-right align-top">{total != null ? formatCurrency(total, totals.currency) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                Once you’re happy, click “Accept quote”. We’ll confirm next steps and timings.
              </div>
            </section>
          </TabsContent>
        </Tabs>
        <footer className="pt-6 text-xs text-muted-foreground">
          Powered by joineryai.app
        </footer>
      </div>
    </div>
  );
}
