"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  clearCustomerPortalToken,
  customerPortalFetch,
  getCustomerPortalToken,
} from "@/lib/customer-portal-auth";

type CustomerMe = {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    clientAccount?: {
      companyName?: string;
    };
  };
};

type FireDoorJobListItem = {
  id: string;
  jobName?: string;
  projectReference?: string;
  status?: string;
  totalPrice?: any;
  submittedAt?: string;
  dateRequired?: string;
  doorItemCount?: number | null;
  type?: "fire-door-job" | "opportunity";
};

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function formatMoneyGBP(value: any) {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

function statusBadgeClass(status?: string) {
  const s = String(status || "").toUpperCase();
  if (s.includes("COMPLETE") || s.includes("DELIVER")) return "bg-green-100 text-green-700 border-green-200";
  if (s.includes("PRODUCTION") || s.includes("IN_PROGRESS")) return "bg-blue-100 text-blue-700 border-blue-200";
  if (s.includes("RFI") || s.includes("ISSUE") || s.includes("HOLD")) return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function CustomerPortalJobsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<CustomerMe | null>(null);
  const [jobs, setJobs] = useState<FireDoorJobListItem[]>([]);

  const companyName = useMemo(() => {
    return me?.user?.clientAccount?.companyName || me?.user?.companyName || "Customer";
  }, [me]);

  useEffect(() => {
    const token = getCustomerPortalToken();
    if (!token) {
      router.replace("/customer-portal/login");
      return;
    }

    (async () => {
      try {
        const [meData, jobsData] = await Promise.all([
          customerPortalFetch<CustomerMe>("/customer-auth/me"),
          customerPortalFetch<{ jobs: FireDoorJobListItem[] }>("/customer-portal/fire-door-jobs"),
        ]);
        setMe(meData);
        setJobs(jobsData?.jobs || []);
      } catch (err: any) {
        const status = err?.status;
        if (status === 401 || status === 403) {
          clearCustomerPortalToken();
          router.replace("/customer-portal/login");
          return;
        }
        toast({
          title: "Could not load jobs",
          description: err?.message || "Please try again",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [router, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 w-full">
      <div className="mx-auto w-full px-6 py-8 space-y-6 max-w-6xl">
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-xl p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Fire Door Schedule
              </h1>
              <p className="text-slate-600 mt-2">{companyName} • View your job status</p>
            </div>
            <Button
              variant="outline"
              className="bg-white/50"
              onClick={() => {
                clearCustomerPortalToken();
                router.replace("/customer-portal/login");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        <Card className="bg-white/70 backdrop-blur border-slate-200">
          <CardHeader>
            <CardTitle>Your projects and jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-sm text-slate-600">Loading…</div>
            ) : jobs.length === 0 ? (
              <div className="py-10 text-slate-600">No projects found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium whitespace-normal">
                        {job.jobName || "—"}
                      </TableCell>
                      <TableCell>{job.projectReference || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusBadgeClass(job.status)}>
                          {job.status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {job.type === "fire-door-job" ? "Fire Door" : "Project"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(job.dateRequired)}</TableCell>
                      <TableCell>{formatDate(job.submittedAt)}</TableCell>
                      <TableCell className="text-right">{formatMoneyGBP(job.totalPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
