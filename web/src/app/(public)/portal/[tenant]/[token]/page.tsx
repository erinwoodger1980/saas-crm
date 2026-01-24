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

  const quoteLines = useMemo(() => (data?.quote?.lines && Array.isArray(data.quote.lines) ? data.quote.lines : []), [data?.quote?.lines]);
  const moodboardFileIds = useMemo(() => {
    const ids: any = data?.quote?.meta?.customerMoodboardFileIds;
    return Array.isArray(ids) ? (ids.filter((x) => typeof x === 'string' && x.trim()) as string[]) : [];
  }, [data?.quote?.meta]);

  const totals = useMemo(() => {
    const currency = data?.quote?.currency || 'GBP';
    const sellTotal = quoteLines.reduce((sum, ln) => sum + (getSellTotal(ln) ?? 0), 0);
    return { currency, sellTotal: Number.isFinite(sellTotal) ? Math.round(sellTotal * 100) / 100 : 0 };
  }, [quoteLines, data?.quote?.currency]);

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
    for (const ln of quoteLines) {
      next[ln.id] = {
        description: String(ln.description ?? '').trim(),
        qty: String(typeof ln.qty === 'number' ? ln.qty : (ln.qty == null ? 1 : Number(ln.qty) || 1)),
      };
    }
    setLineDrafts(next);
  }, [data?.quote?.id, quoteLines.length]);

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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            {data.tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.tenant.logoUrl}
                alt={data.tenant.name}
                className="h-10 w-auto max-w-[180px] object-contain"
              />
            ) : null}
            <div>
              <div className="text-lg font-semibold">{data.tenant.name}</div>
              <div className="text-xs text-muted-foreground">
                {data.tenant.website ? (
                  <a className="underline" href={data.tenant.website} target="_blank" rel="noreferrer">
                    {data.tenant.website}
                  </a>
                ) : null}
                {data.tenant.website && data.tenant.phone ? <span> · </span> : null}
                {data.tenant.phone || null}
              </div>
            </div>
          </div>

          {bookingUrl ? (
            <Button asChild>
              <a href={bookingUrl} target="_blank" rel="noreferrer">Book an appointment</a>
            </Button>
          ) : null}
        </header>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-xl border bg-background/60 px-4 py-3">
            <div className="text-xs text-muted-foreground">Quote</div>
            <div className="text-lg font-semibold">{data.quote.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">Status: {data.quote.status}</div>
          </div>
          <div className="flex items-center gap-2">
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

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="client">Client details</TabsTrigger>
            <TabsTrigger value="product">Product details</TabsTrigger>
            <TabsTrigger value="quote">Quote details</TabsTrigger>
          </TabsList>

          <TabsContent value="client" className="mt-6 grid gap-6">
            <section className="rounded-2xl border bg-background/70 p-4 shadow-sm">
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
              <section className="rounded-2xl border bg-background/70 p-4 shadow-sm">
                <div className="text-sm font-medium">Peace of mind</div>
                {Array.isArray(data.tenant.quoteDefaults?.guarantees) && data.tenant.quoteDefaults.guarantees.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {data.tenant.quoteDefaults.guarantees.slice(0, 6).map((g: any, idx: number) => (
                      <li key={idx}>{String(g)}</li>
                    ))}
                  </ul>
                ) : null}
                {Array.isArray(data.tenant.testimonials) && data.tenant.testimonials.length ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {data.tenant.testimonials.slice(0, 4).map((t: any, idx: number) => (
                      <div key={idx} className="rounded-xl border bg-background p-3">
                        <div className="text-sm">{String(t?.quote || t?.text || t)}</div>
                        {t?.name ? <div className="mt-2 text-xs text-muted-foreground">— {String(t.name)}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </TabsContent>

          <TabsContent value="product" className="mt-6 grid gap-6">
            <section className="rounded-2xl border bg-background/70 p-4 shadow-sm">
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
                <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-6">
                  {moodboardFileIds.slice(0, 18).map((fid) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={fid} src={fileUrl(fid)} alt="Moodboard" className="aspect-square w-full rounded-lg border object-cover" />
                  ))}
                </div>
              ) : null}

              <div className="mt-6 grid gap-4">
                {quoteLines.map((ln) => {
                  const draft = lineDrafts[ln.id] || { description: String(ln.description ?? ''), qty: String(ln.qty ?? 1) };
                  const photoId = ln.lineStandard?.photoOutsideFileId || ln.lineStandard?.photoFileId || null;
                  return (
                    <div key={ln.id} className="rounded-xl border bg-background p-4">
                      <div className="grid gap-4 md:grid-cols-[120px_1fr]">
                        <div>
                          <div className="aspect-square w-full overflow-hidden rounded-lg border bg-muted/30">
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
            <section className="rounded-2xl border bg-background/70 p-4 shadow-sm">
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

              <div className="mt-4 overflow-x-auto rounded-xl border bg-background">
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
                    {quoteLines.map((ln) => {
                      const unit = getSellUnit(ln);
                      const total = getSellTotal(ln);
                      return (
                        <tr key={ln.id} className="border-t">
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

              <div className="mt-4 rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
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
