"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, DoorOpen } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FireDoorJob {
  id: string;
  jobName: string | null;
  projectReference: string | null;
  status: string;
  totalPrice: number | string | null;
  submittedAt: string | null;
  dateRequired: string | null;
  doorItemCount: number;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  IN_REVIEW: "bg-purple-100 text-purple-800",
  CONFIRMED: "bg-indigo-100 text-indigo-800",
  IN_PRODUCTION: "bg-amber-100 text-amber-800",
  READY: "bg-teal-100 text-teal-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

function formatCurrencyGBP(value: number | string | null) {
  if (value === null || value === undefined || value === "") return "TBC";
  const asNumber = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(asNumber)) return "TBC";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(asNumber);
}

function formatDate(date: string | null) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function CustomerFireDoorsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<FireDoorJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("customerToken");
    if (!token) {
      router.push("/customer/login");
      return;
    }

    fetch("/api/customer-portal/fire-door-jobs", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const message = body?.error || "Failed to load fire door orders";
          throw new Error(message);
        }
        return res.json();
      })
      .then((data) => {
        setJobs(Array.isArray(data.jobs) ? data.jobs : []);
        setLoading(false);
      })
      .catch(() => {
        setJobs([]);
        setLoading(false);
      });
  }, [router]);

  const filteredJobs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return jobs;

    return jobs.filter((job) => {
      const jobName = (job.jobName || "").toLowerCase();
      const reference = (job.projectReference || "").toLowerCase();
      const status = (job.status || "").toLowerCase();
      return jobName.includes(term) || reference.includes(term) || status.includes(term);
    });
  }, [jobs, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fire Door Orders</h1>
          <p className="text-gray-600 mt-2">Track the status of your fire door jobs</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Fire Door Orders</CardTitle>
              <CardDescription>
                {filteredJobs.length} {filteredJobs.length === 1 ? "order" : "orders"}
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredJobs.length === 0 ? (
            <div className="text-center py-12">
              <DoorOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No fire door orders found</h3>
              <p className="text-gray-500">
                {searchTerm ? "Try adjusting your search" : "Your fire door orders will appear here"}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead className="text-right">Doors</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow key={job.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium">{job.jobName || "Fire door job"}</div>
                        <div className="text-sm text-gray-500">
                          {job.projectReference ? job.projectReference : `#${job.id.slice(0, 8)}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusColors[job.status] || "bg-gray-100 text-gray-800"}
                        >
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(job.submittedAt)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(job.dateRequired)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm font-medium">{job.doorItemCount}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrencyGBP(job.totalPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
