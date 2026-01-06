"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  clearCustomerPortalToken,
  customerPortalFetch,
  getCustomerPortalToken,
} from "@/lib/customer-portal-auth";
import FireDoorSchedulePage from "@/app/fire-door-schedule/page";

type CustomerMe = {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    clientAccount?: {
      id: string;
      companyName?: string;
    };
  };
};

interface Stats {
  totalProjects: number;
  redFolder: number;
  inProgress: number;
  complete: number;
  totalValue: number;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatMoneyGBP(value?: any) {
  if (value == null) return "£0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "£0";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

export default function CustomerPortalJobsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<CustomerMe | null>(null);

  useEffect(() => {
    const token = getCustomerPortalToken();
    if (!token) {
      router.replace("/customer-portal/login");
      return;
    }

    (async () => {
      try {
        const meData = await customerPortalFetch<CustomerMe>("/customer-auth/me");
        setMe(meData);
      } catch (err: any) {
        const status = err?.status;
        if (status === 401 || status === 403) {
          clearCustomerPortalToken();
          router.replace("/customer-portal/login");
          return;
        }
        toast({
          title: "Could not load data",
          description: err?.message || "Please try again",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [router, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading your projects...</div>
      </div>
    );
  }

  const companyName = me?.user?.clientAccount?.companyName || me?.user?.companyName || "Customer";
  const clientAccountId = me?.user?.clientAccount?.id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="mx-auto w-full px-6 py-8">
        {/* Header */}
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Fire Door Schedule
              </h1>
              <p className="text-slate-600 text-sm mt-1">
                {companyName} • Track from enquiry to delivery
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                clearCustomerPortalToken();
                router.push("/customer-portal/login");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        {/* Reuse the Fire Door Schedule component with client filter */}
        {clientAccountId && (
          <FireDoorSchedulePage 
            isCustomerPortal={true} 
            clientAccountId={clientAccountId}
          />
        )}
      </div>
    </div>
  );
}
