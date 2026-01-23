'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item) || 'Other';
    acc[k] = acc[k] || [];
    acc[k].push(item);
    return acc;
  }, {});
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

  const bookingUrl = useMemo(() => firstUrlFromLinks(data?.tenant?.links), [data?.tenant?.links]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`/public/quote-portal/${encodeURIComponent(token)}`, { cache: 'no-store' });
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

  const handleSaveClient = async () => {
    try {
      setError(null);
      const r = await fetch(`/public/quote-portal/${encodeURIComponent(token)}/client`, {
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
      const refreshed = await fetch(`/public/quote-portal/${encodeURIComponent(token)}`, { cache: 'no-store' });
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
      const r = await fetch(`/public/quote-portal/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clientForm.name || data.client?.name || undefined,
          email: clientForm.email || data.client?.email || undefined,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message || 'Failed to accept quote');
      const refreshed = await fetch(`/public/quote-portal/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const refreshedJson = (await refreshed.json()) as PortalData;
      setData(refreshedJson);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to accept quote'));
    }
  };

  const quotesByStatus = useMemo(() => groupBy(data?.quotes || [], (q) => q.status || 'Other'), [data?.quotes]);
  const ordersByStage = useMemo(() => groupBy(data?.orders || [], (o) => o.stage || 'Other'), [data?.orders]);

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

  const primaryOrder = (data.orders || [])[0] || null;

  return (
    <div className="min-h-screen bg-background">
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

        <div className="mt-8 grid gap-6">
          <section className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Quote</div>
                <div className="mt-1 text-lg font-semibold">{data.quote.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">Status: {data.quote.status}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total</div>
                <div className="text-lg font-semibold">£{Number(data.quote.totalGBP || 0).toFixed(2)}</div>
                {data.quote.status !== 'ACCEPTED' ? (
                  <Button className="mt-2" onClick={handleAcceptQuote}>
                    Accept quote
                  </Button>
                ) : (
                  <div className="mt-2 text-xs text-muted-foreground">Accepted</div>
                )}
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Required info: please confirm your details below.
            </div>
          </section>

          <section className="rounded-lg border p-4">
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

          {primaryOrder ? (
            <section className="rounded-lg border p-4">
              <div className="text-sm font-medium">Progress & key dates</div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="text-sm"><span className="text-muted-foreground">Start:</span> {formatDate(primaryOrder.startDate)}</div>
                <div className="text-sm"><span className="text-muted-foreground">Delivery:</span> {formatDate(primaryOrder.deliveryDate)}</div>
                <div className="text-sm"><span className="text-muted-foreground">Installation start:</span> {formatDate(primaryOrder.installationStartDate)}</div>
                <div className="text-sm"><span className="text-muted-foreground">Installation end:</span> {formatDate(primaryOrder.installationEndDate)}</div>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">Material tracking</div>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="text-sm">Timber: {primaryOrder.timberNotApplicable ? 'N/A' : `${formatDate(primaryOrder.timberOrderedAt)} → ${formatDate(primaryOrder.timberExpectedAt)} → ${formatDate(primaryOrder.timberReceivedAt)}`}</div>
                <div className="text-sm">Glass: {primaryOrder.glassNotApplicable ? 'N/A' : `${formatDate(primaryOrder.glassOrderedAt)} → ${formatDate(primaryOrder.glassExpectedAt)} → ${formatDate(primaryOrder.glassReceivedAt)}`}</div>
                <div className="text-sm">Ironmongery: {primaryOrder.ironmongeryNotApplicable ? 'N/A' : `${formatDate(primaryOrder.ironmongeryOrderedAt)} → ${formatDate(primaryOrder.ironmongeryExpectedAt)} → ${formatDate(primaryOrder.ironmongeryReceivedAt)}`}</div>
                <div className="text-sm">Paint: {primaryOrder.paintNotApplicable ? 'N/A' : `${formatDate(primaryOrder.paintOrderedAt)} → ${formatDate(primaryOrder.paintExpectedAt)} → ${formatDate(primaryOrder.paintReceivedAt)}`}</div>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border p-4">
            <div className="text-sm font-medium">Quotes</div>
            <div className="mt-3 grid gap-4">
              {Object.entries(quotesByStatus).map(([status, items]) => (
                <div key={status}>
                  <div className="text-xs font-medium text-muted-foreground">{status}</div>
                  <div className="mt-2 grid gap-2">
                    {items.map((q) => (
                      <div key={q.id} className="rounded border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">{q.title || 'Quote'}</div>
                          <div>£{Number(q.totalGBP || 0).toFixed(2)}</div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">Updated {formatDate(q.updatedAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border p-4">
            <div className="text-sm font-medium">Orders</div>
            <div className="mt-3 grid gap-4">
              {Object.keys(ordersByStage).length === 0 ? (
                <div className="text-sm text-muted-foreground">No orders yet.</div>
              ) : (
                Object.entries(ordersByStage).map(([stage, items]) => (
                  <div key={stage}>
                    <div className="text-xs font-medium text-muted-foreground">{stage}</div>
                    <div className="mt-2 grid gap-2">
                      {items.map((o) => (
                        <div key={o.id} className="rounded border px-3 py-2 text-sm">
                          <div className="font-medium">{o.title || 'Order'}</div>
                          <div className="mt-1 text-xs text-muted-foreground">Delivery {formatDate(o.deliveryDate)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border p-4">
            <div className="text-sm font-medium">Invoices</div>
            <div className="mt-3 grid gap-2">
              {(data.invoices || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No invoices available.</div>
              ) : (
                data.invoices.map((inv) => {
                  const due = inv.dueDate ? new Date(inv.dueDate) : null;
                  const isOverdue = due ? due.getTime() < Date.now() : false;
                  return (
                    <div key={inv.id} className="rounded border px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">
                          {inv.documentNumber || inv.referenceText || inv.externalType}
                        </div>
                        <div>
                          {inv.currency} {Number(inv.total || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Issued {formatDate(inv.issueDate)} · Due {formatDate(inv.dueDate)}
                        {isOverdue ? <span className="text-destructive"> · Overdue</span> : null}
                        {inv.status ? <span> · {inv.status}</span> : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <footer className="pt-2 text-xs text-muted-foreground">
            Powered by joineryai.app
          </footer>
        </div>
      </div>
    </div>
  );
}
