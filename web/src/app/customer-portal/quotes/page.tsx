"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { clearCustomerPortalToken, customerPortalFetch, getCustomerPortalToken } from "@/lib/customer-portal-auth";
import { ArrowRight, FileText, LogOut } from "lucide-react";

type CustomerPortalQuoteListItem = {
  id: string;
  title?: string | null;
  status?: string | null;
  totalGBP?: any;
  currency?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lead?: { contactName?: string | null; email?: string | null } | null;
};

function formatMoneyGBP(value: any) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function CustomerPortalQuotesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<CustomerPortalQuoteListItem[]>([]);

  const token = useMemo(() => getCustomerPortalToken(), []);

  useEffect(() => {
    if (!token) {
      router.replace("/customer-portal/login");
      return;
    }

    (async () => {
      try {
        const data = await customerPortalFetch<{ quotes: CustomerPortalQuoteListItem[] }>("/customer-portal/quotes");
        setQuotes(Array.isArray(data?.quotes) ? data.quotes : []);
      } catch (err: any) {
        const status = err?.status;
        if (status === 401 || status === 403) {
          clearCustomerPortalToken();
          router.replace("/customer-portal/login");
          return;
        }
        toast({ title: "Could not load quotes", description: err?.message || "Please try again", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [router, toast, token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-xl p-5 sm:p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Your Quotes
              </h1>
              <p className="text-slate-600 text-sm mt-1">
                Review product details, upload photos, and track pricing
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                clearCustomerPortalToken();
                router.push("/customer-portal/login");
              }}
              className="shrink-0"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-slate-600">Loading…</div>
        ) : quotes.length === 0 ? (
          <Card className="bg-white/70 backdrop-blur border-slate-200">
            <CardHeader>
              <CardTitle>No quotes yet</CardTitle>
              <CardDescription>When a quote is ready, it will appear here.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => router.push("/customer-portal")}>Back to portal</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {quotes.map((q) => (
              <Card key={q.id} className="bg-white/70 backdrop-blur border-slate-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        {q.title || "Quote"}
                      </CardTitle>
                      <CardDescription>
                        {q.lead?.contactName ? `${q.lead.contactName} · ` : ""}{formatDate(q.createdAt)}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">{formatMoneyGBP(q.totalGBP)}</div>
                      <div className="text-xs text-slate-500">{q.status || "—"}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button className="w-full justify-between" onClick={() => router.push(`/customer-portal/quotes/${q.id}`)}>
                    Open quote
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
