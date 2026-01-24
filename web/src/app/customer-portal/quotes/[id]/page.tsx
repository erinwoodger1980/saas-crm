"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { clearCustomerPortalToken, customerPortalFetch, getCustomerPortalToken } from "@/lib/customer-portal-auth";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  HeartHandshake,
  ImageIcon,
  Plus,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

type QuoteLine = {
  id: string;
  description: string;
  qty: any;
  unitPrice: any;
  currency?: string | null;
  meta?: Record<string, any> | null;
  lineStandard?: Record<string, any> | null;
};

type CustomerPortalQuoteDetailResponse = {
  quote: {
    id: string;
    title: string;
    status?: string | null;
    currency?: string | null;
    totalGBP?: any;
    meta?: Record<string, any> | null;
    clientAccount?: {
      companyName?: string | null;
      primaryContact?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      city?: string | null;
      postcode?: string | null;
      country?: string | null;
    } | null;
    lead?: { contactName?: string | null; email?: string | null } | null;
    lines: QuoteLine[];
  };
  tenantSettings?: {
    brandName?: string | null;
    logoUrl?: string | null;
    reviewCount?: number | null;
    reviewScore?: any;
    reviewSourceLabel?: string | null;
    quoteDefaults?: any;
    testimonials?: any;
    website?: string | null;
    phone?: string | null;
  } | null;
  imageUrlMap?: Record<string, string>;
};

function formatMoneyGBP(value: any, fallback: string = "—") {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function normalizeNumber(value: any): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getSellUnit(line: QuoteLine): number | null {
  const meta = line.meta || {};
  const ls = line.lineStandard || {};
  const fromMeta = normalizeNumber((meta as any).sellUnitGBP ?? (meta as any).sell_unit ?? (meta as any).sellUnitGBP);
  if (fromMeta != null) return fromMeta;
  const fromLs = normalizeNumber((ls as any).sellUnitGBP);
  if (fromLs != null) return fromLs;
  const unit = normalizeNumber(line.unitPrice);
  return unit != null ? unit : null;
}

function getSellTotal(line: QuoteLine): number | null {
  const meta = line.meta || {};
  const fromMeta = normalizeNumber((meta as any).sellTotalGBP ?? (meta as any).sell_total ?? (meta as any).sellTotalGBP);
  if (fromMeta != null) return fromMeta;
  const unit = getSellUnit(line);
  const qty = Math.max(0, normalizeNumber(line.qty) ?? 0);
  return unit != null ? unit * qty : null;
}

function getLinePhotoUrl(line: QuoteLine, imageUrlMap?: Record<string, string>) {
  const ls: any = line.lineStandard || {};
  const meta: any = line.meta || {};
  const fid = ls.photoOutsideFileId || ls.photoInsideFileId || ls.photoFileId || meta.imageFileId;
  if (!fid || typeof fid !== "string") return null;
  return imageUrlMap?.[fid] || null;
}

function getMoodboardIds(quoteMeta: any): string[] {
  const raw = quoteMeta?.customerMoodboardFileIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x: any) => typeof x === "string" && x.trim()).map((x: string) => x.trim());
}

export default function CustomerPortalQuotePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const quoteId = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [uploadingForLineId, setUploadingForLineId] = useState<string | null>(null);
  const [uploadingMoodboard, setUploadingMoodboard] = useState(false);

  const [data, setData] = useState<CustomerPortalQuoteDetailResponse | null>(null);
  const [tab, setTab] = useState("client");

  const token = useMemo(() => getCustomerPortalToken(), []);
  const autosaveTimers = useRef<Record<string, number>>({});

  const quote = data?.quote;
  const tenant = data?.tenantSettings;
  const imageUrlMap = data?.imageUrlMap || {};

  const brandName = tenant?.brandName || "Your Project";
  const moodboardIds = useMemo(() => getMoodboardIds(quote?.meta), [quote?.meta]);

  const moodboardUrls = useMemo(() => moodboardIds.map((id) => imageUrlMap?.[id]).filter(Boolean) as string[], [moodboardIds, imageUrlMap]);

  const fetchQuote = useCallback(async () => {
    if (!quoteId) return;
    setLoading(true);
    try {
      const res = await customerPortalFetch<CustomerPortalQuoteDetailResponse>(`/customer-portal/quotes/${encodeURIComponent(quoteId)}`);
      setData(res);
    } catch (err: any) {
      const status = err?.status;
      if (status === 401 || status === 403) {
        clearCustomerPortalToken();
        router.replace("/customer-portal/login");
        return;
      }
      toast({ title: "Could not load quote", description: err?.message || "Please try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [quoteId, router, toast]);

  useEffect(() => {
    if (!token) {
      router.replace("/customer-portal/login");
      return;
    }
    void fetchQuote();
  }, [fetchQuote, router, token]);

  const shareLink = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;
    try {
      const nav: any = navigator as any;
      if (typeof nav?.share === "function") {
        await nav.share({ title: quote?.title || "Quote", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Share it with your partner" });
    } catch (e: any) {
      toast({ title: "Could not share", description: e?.message || "Please try again", variant: "destructive" });
    }
  }, [quote?.title, toast]);

  const updateLine = useCallback(
    async (lineId: string, patch: Partial<{ description: string; qty: number; lineStandard: Record<string, any> }>) => {
      if (!quoteId) return;
      setSavingLineId(lineId);
      try {
        await customerPortalFetch(`/customer-portal/quotes/${encodeURIComponent(quoteId)}/lines/${encodeURIComponent(lineId)}`,
          {
            method: "PATCH",
            json: patch,
          }
        );
        await fetchQuote();
      } catch (e: any) {
        toast({ title: "Could not save", description: e?.message || "Please try again", variant: "destructive" });
      } finally {
        setSavingLineId(null);
      }
    },
    [fetchQuote, quoteId, toast]
  );

  const scheduleLineAutosave = useCallback(
    (lineId: string, patch: Partial<{ description: string; qty: number }>) => {
      const timers = autosaveTimers.current;
      if (timers[lineId]) window.clearTimeout(timers[lineId]);
      timers[lineId] = window.setTimeout(() => {
        void updateLine(lineId, patch);
      }, 700);
    },
    [updateLine]
  );

  const addLine = useCallback(async () => {
    if (!quoteId) return;
    try {
      await customerPortalFetch(`/customer-portal/quotes/${encodeURIComponent(quoteId)}/lines`, { method: "POST", json: { description: "New item", qty: 1 } });
      await fetchQuote();
      setTab("products");
      toast({ title: "Added line item", description: "Fill in the details and upload a photo" });
    } catch (e: any) {
      toast({ title: "Could not add line", description: e?.message || "Please try again", variant: "destructive" });
    }
  }, [fetchQuote, quoteId, toast]);

  const uploadLinePhoto = useCallback(
    async (lineId: string, file: File) => {
      if (!quoteId) return;
      setUploadingForLineId(lineId);
      try {
        const fd = new FormData();
        fd.append("file", file);
        await customerPortalFetch(`/customer-portal/quotes/${encodeURIComponent(quoteId)}/lines/${encodeURIComponent(lineId)}/photo`, {
          method: "POST",
          body: fd as any,
        } as any);
        await fetchQuote();
        toast({ title: "Photo uploaded", description: "Thanks — this helps us match the right product" });
      } catch (e: any) {
        toast({ title: "Upload failed", description: e?.message || "Please try again", variant: "destructive" });
      } finally {
        setUploadingForLineId(null);
      }
    },
    [fetchQuote, quoteId, toast]
  );

  const uploadMoodboard = useCallback(
    async (files: FileList | null) => {
      if (!quoteId || !files || files.length === 0) return;
      setUploadingMoodboard(true);
      try {
        const fd = new FormData();
        Array.from(files).forEach((f) => fd.append("files", f));
        await customerPortalFetch(`/customer-portal/quotes/${encodeURIComponent(quoteId)}/moodboard`, {
          method: "POST",
          body: fd as any,
        } as any);
        await fetchQuote();
        toast({ title: "Moodboard updated", description: "Great — we’ll design around your inspiration" });
      } catch (e: any) {
        toast({ title: "Upload failed", description: e?.message || "Please try again", variant: "destructive" });
      } finally {
        setUploadingMoodboard(false);
      }
    },
    [fetchQuote, quoteId, toast]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading…</div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Quote not found.</div>
      </div>
    );
  }

  const guarantees: Array<{ title: string; description: string }> = Array.isArray(tenant?.quoteDefaults?.guarantees)
    ? tenant?.quoteDefaults?.guarantees
    : [];
  const testimonials: Array<{ quote: string; client: string; role?: string }> = Array.isArray(tenant?.quoteDefaults?.testimonials)
    ? tenant?.quoteDefaults?.testimonials
    : Array.isArray(tenant?.testimonials)
      ? tenant?.testimonials
      : [];

  const client = quote.clientAccount;
  const clientName = client?.primaryContact || quote.lead?.contactName || "";

  const lines = Array.isArray(quote.lines) ? quote.lines : [];

  const totalSell = lines.reduce((sum, ln) => sum + (getSellTotal(ln) ?? 0), 0);
  const total = normalizeNumber(quote.totalGBP) ?? totalSell;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-xl p-5 sm:p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                {tenant?.logoUrl ? (
                  <img src={tenant.logoUrl} alt="logo" className="h-10 w-auto rounded" />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-semibold">
                    {brandName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{quote.title || "Your quote"}</h1>
                  <p className="text-sm text-slate-600 truncate">
                    {client?.companyName || ""}{clientName ? ` · ${clientName}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Card className="bg-white/70 border-slate-200">
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm text-slate-600">Project status</CardTitle>
                    <div className="text-base font-semibold text-slate-900">{quote.status || "—"}</div>
                  </CardHeader>
                </Card>
                <Card className="bg-white/70 border-slate-200">
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm text-slate-600">Estimated total</CardTitle>
                    <div className="text-base font-semibold text-slate-900">{formatMoneyGBP(total)}</div>
                  </CardHeader>
                </Card>
                <Card className="bg-white/70 border-slate-200">
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm text-slate-600">Next step</CardTitle>
                    <div className="text-base font-semibold text-slate-900">Confirm products & photos</div>
                  </CardHeader>
                </Card>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <Button variant="outline" onClick={() => router.push("/customer-portal/quotes")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button onClick={shareLink} className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" /> Share
              </Button>
            </div>
          </div>

          {(tenant?.reviewScore || tenant?.reviewCount) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>
                Rated {tenant.reviewScore ? Number(tenant.reviewScore).toFixed(1) : "—"} / 5
                {tenant.reviewCount ? ` · ${tenant.reviewCount} reviews` : ""}
                {tenant.reviewSourceLabel ? ` · ${tenant.reviewSourceLabel}` : ""}
              </span>
            </div>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 rounded-2xl bg-white/70 backdrop-blur border border-white/20 shadow-sm">
            <TabsTrigger value="client" className="rounded-xl">Client details</TabsTrigger>
            <TabsTrigger value="products" className="rounded-xl">Product details</TabsTrigger>
            <TabsTrigger value="quote" className="rounded-xl">Quote details</TabsTrigger>
          </TabsList>

          <TabsContent value="client" className="mt-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="bg-white/70 backdrop-blur border-slate-200 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-600" /> Your details</CardTitle>
                  <CardDescription>Confirm these are correct so we can deliver smoothly.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs text-slate-600">Name</Label>
                    <div className="mt-1 text-sm font-medium text-slate-900">{clientName || "—"}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Email</Label>
                    <div className="mt-1 text-sm font-medium text-slate-900">{client?.email || quote.lead?.email || "—"}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Phone</Label>
                    <div className="mt-1 text-sm font-medium text-slate-900">{client?.phone || tenant?.phone || "—"}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Company</Label>
                    <div className="mt-1 text-sm font-medium text-slate-900">{client?.companyName || "—"}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-slate-600">Address</Label>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {[client?.address, client?.city, client?.postcode, client?.country].filter(Boolean).join(", ") || "—"}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-blue-600" /> You’re in safe hands</CardTitle>
                  <CardDescription>Clear steps. Clear expectations. Great craftsmanship.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <ShieldCheck className="h-4 w-4 text-green-700 mt-0.5" />
                    <span>We’ll confirm every spec before manufacturing.</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <FileText className="h-4 w-4 text-blue-700 mt-0.5" />
                    <span>Transparent pricing and line-by-line clarity.</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <Camera className="h-4 w-4 text-purple-700 mt-0.5" />
                    <span>Upload photos to match the right style and finish.</span>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setTab("products")}>
                    Continue to product details
                  </Button>
                </CardContent>
              </Card>
            </div>

            {(guarantees.length > 0 || testimonials.length > 0) && (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {guarantees.length > 0 && (
                  <Card className="bg-white/70 backdrop-blur border-slate-200">
                    <CardHeader>
                      <CardTitle>Guarantees</CardTitle>
                      <CardDescription>Peace of mind built in.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {guarantees.slice(0, 6).map((g, idx) => (
                        <div key={idx} className="rounded-xl border bg-white/60 p-3">
                          <div className="text-sm font-semibold text-slate-900">{g.title}</div>
                          <div className="text-xs text-slate-600 mt-1">{g.description}</div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {testimonials.length > 0 && (
                  <Card className="bg-white/70 backdrop-blur border-slate-200">
                    <CardHeader>
                      <CardTitle>Testimonials</CardTitle>
                      <CardDescription>What clients say after installation.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {testimonials.slice(0, 3).map((t, idx) => (
                        <div key={idx} className="rounded-xl border bg-white/60 p-3">
                          <div className="text-sm text-slate-800">“{t.quote}”</div>
                          <div className="mt-2 text-xs font-medium text-slate-700">{t.client}{t.role ? ` · ${t.role}` : ""}</div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="bg-white/70 backdrop-blur border-slate-200 lg:col-span-2">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>Product details</CardTitle>
                      <CardDescription>Add items, confirm quantities, and upload photos.</CardDescription>
                    </div>
                    <Button onClick={addLine} className="shrink-0">
                      <Plus className="h-4 w-4 mr-2" /> Add item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lines.map((ln) => {
                    const photoUrl = getLinePhotoUrl(ln, imageUrlMap);
                    const qty = Math.max(1, normalizeNumber(ln.qty) ?? 1);
                    const isSaving = savingLineId === ln.id;
                    const isUploading = uploadingForLineId === ln.id;
                    return (
                      <div key={ln.id} className="rounded-2xl border bg-white/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <Label className="text-xs text-slate-600">Description</Label>
                            <Textarea
                              value={ln.description || ""}
                              onChange={(e) => {
                                const next = e.target.value;
                                setData((prev) => {
                                  if (!prev?.quote) return prev;
                                  return {
                                    ...prev,
                                    quote: {
                                      ...prev.quote,
                                      lines: prev.quote.lines.map((x) => (x.id === ln.id ? { ...x, description: next } : x)),
                                    },
                                  };
                                });
                                scheduleLineAutosave(ln.id, { description: next });
                              }}
                              className="mt-1"
                              rows={3}
                            />
                          </div>
                          <div className="w-28">
                            <Label className="text-xs text-slate-600">Qty</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={qty}
                              onChange={(e) => {
                                const next = Number(e.target.value);
                                const safe = Number.isFinite(next) && next > 0 ? next : 1;
                                setData((prev) => {
                                  if (!prev?.quote) return prev;
                                  return {
                                    ...prev,
                                    quote: {
                                      ...prev.quote,
                                      lines: prev.quote.lines.map((x) => (x.id === ln.id ? { ...x, qty: safe } : x)),
                                    },
                                  };
                                });
                                scheduleLineAutosave(ln.id, { qty: safe });
                              }}
                              className="mt-1"
                              min={1}
                            />
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border bg-white/70 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                                <ImageIcon className="h-4 w-4 text-slate-500" />
                                Photo
                              </div>
                              <label className="inline-flex items-center">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={isUploading}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    void uploadLinePhoto(ln.id, f);
                                    e.currentTarget.value = "";
                                  }}
                                />
                                <Button type="button" size="sm" variant="outline" disabled={isUploading} className="gap-2">
                                  <Upload className="h-4 w-4" />
                                  {isUploading ? "Uploading…" : "Upload"}
                                </Button>
                              </label>
                            </div>
                            <div className="mt-3">
                              {photoUrl ? (
                                <img src={photoUrl} alt="Line item" className="h-36 w-full rounded-lg object-cover border" />
                              ) : (
                                <div className="h-36 w-full rounded-lg border bg-slate-50 flex items-center justify-center text-slate-500 text-sm">
                                  Add a photo to match style & finish
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl border bg-white/70 p-3">
                            <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                              <Copy className="h-4 w-4 text-slate-500" />
                              Status
                            </div>
                            <div className="mt-2 text-xs text-slate-600">
                              {isSaving ? "Saving your changes…" : "Saved automatically"}
                            </div>
                            <div className="mt-3 text-sm text-slate-700">
                              Tip: Add any notes in the description (e.g. “oak veneer”, “black hardware”, “frosted glazing”).
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="outline" onClick={() => setTab("client")}>
                      Back
                    </Button>
                    <Button onClick={() => setTab("quote")}>Continue to quote details</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-600" /> Moodboard</CardTitle>
                  <CardDescription>Upload inspiration photos — we’ll align the look & feel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="inline-flex items-center w-full">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={uploadingMoodboard}
                      onChange={(e) => {
                        void uploadMoodboard(e.target.files);
                        e.currentTarget.value = "";
                      }}
                    />
                    <Button type="button" variant="outline" className="w-full gap-2" disabled={uploadingMoodboard}>
                      <Upload className="h-4 w-4" />
                      {uploadingMoodboard ? "Uploading…" : "Upload inspiration"}
                    </Button>
                  </label>

                  {moodboardUrls.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {moodboardUrls.slice(0, 9).map((u, idx) => (
                        <img key={idx} src={u} alt="Moodboard" className="h-20 w-full rounded-lg object-cover border" />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-white/60 p-3 text-sm text-slate-700">
                      Upload photos of doors/windows you love, hardware finishes, colours, or similar projects.
                    </div>
                  )}

                  <div className="rounded-xl border bg-white/60 p-3 text-sm text-slate-700">
                    <div className="font-semibold text-slate-900">Share with a partner</div>
                    <div className="text-xs text-slate-600 mt-1">Tap share to send this page link.</div>
                    <Button onClick={shareLink} className="w-full mt-3">
                      <ExternalLink className="h-4 w-4 mr-2" /> Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="quote" className="mt-6">
            <Card className="bg-white/70 backdrop-blur border-slate-200">
              <CardHeader>
                <CardTitle>Quote details</CardTitle>
                <CardDescription>Pricing is shown for review. Changes are locked to keep everything consistent.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-2xl border">
                  <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/80 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Description</th>
                          <th className="px-4 py-3 text-right font-medium">Qty</th>
                          <th className="px-4 py-3 text-right font-medium">Unit</th>
                          <th className="px-4 py-3 text-right font-medium">Line total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-white">
                        {lines.map((ln) => {
                          const qty = Math.max(0, normalizeNumber(ln.qty) ?? 0);
                          const unit = getSellUnit(ln);
                          const lineTotal = getSellTotal(ln);
                          return (
                            <tr key={ln.id} className="hover:bg-slate-50/80">
                              <td className="px-4 py-3 align-top">
                                <div className="font-medium text-slate-900">{ln.description || "—"}</div>
                              </td>
                              <td className="px-4 py-3 text-right align-top">{qty}</td>
                              <td className="px-4 py-3 text-right align-top">{unit != null ? formatMoneyGBP(unit) : "—"}</td>
                              <td className="px-4 py-3 text-right align-top font-semibold">{lineTotal != null ? formatMoneyGBP(lineTotal) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end">
                  <div className="w-full max-w-sm rounded-2xl border bg-white/60 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Total</span>
                      <span className="font-semibold text-slate-900">{formatMoneyGBP(total)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-600" /> What happens next</CardTitle>
                      <CardDescription>A smooth journey to beautiful new doors and windows.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm text-slate-700">1) You confirm product details and upload photos</div>
                      <div className="text-sm text-slate-700">2) We confirm specs and finalise the quote</div>
                      <div className="text-sm text-slate-700">3) Production and delivery scheduling</div>
                      <Button variant="outline" className="w-full" onClick={() => setTab("products")}>Review product details</Button>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/70 backdrop-blur border-slate-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-green-700" /> Need changes?</CardTitle>
                      <CardDescription>Update the product details tab — we’ll take care of the pricing.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full" onClick={() => setTab("products")}>
                        Edit product details
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
