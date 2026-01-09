"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimesheetsManagement } from "../../timesheets/page";

interface HolidayRequest {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: "pending" | "approved" | "denied";
  adminNotes: string | null;
  approvedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    holidayAllowance: number;
  };
}

interface UserBalance {
  userId: string;
  allowance: number;
  used: number;
  remaining: number;
}

function HolidayRequestsPanel() {
  const [requests, setRequests] = useState<HolidayRequest[]>([]);
  const [balances, setBalances] = useState<Record<string, UserBalance>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "denied">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/workshop/holiday-requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);

        const uniqueUserIds = Array.from(new Set(data.requests.map((r: HolidayRequest) => r.userId)));
        const balancePromises = uniqueUserIds.map(async (userId) => {
          const balanceRes = await fetch(`/api/workshop/holiday-balance?userId=${userId}`);
          if (balanceRes.ok) {
            const balanceData = await balanceRes.json();
            return { userId, ...balanceData };
          }
          return null;
        });

        const balanceResults = await Promise.all(balancePromises);
        const balanceMap: Record<string, UserBalance> = {};
        balanceResults.forEach((b) => {
          if (b) balanceMap[b.userId] = b;
        });
        setBalances(balanceMap);
      }
    } catch (error) {
      console.error("Failed to load holiday requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (requestId: string) => {
    if (processingId) return;
    
    setProcessingId(requestId);
    try {
      const res = await fetch(`/api/workshop/holiday-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: "approved",
          adminNotes: adminNotes[requestId] || null,
        }),
      });

      if (res.ok) {
        await loadRequests();
        setAdminNotes((prev) => {
          const updated = { ...prev };
          delete updated[requestId];
          return updated;
        });
      } else {
        alert("Failed to approve request");
      }
    } catch (error) {
      console.error("Failed to approve:", error);
      alert("Error approving request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeny = async (requestId: string) => {
    if (processingId) return;

    const notes = adminNotes[requestId];
    if (!notes?.trim()) {
      alert("Please provide a reason for denial in the admin notes");
      return;
    }

    setProcessingId(requestId);
    try {
      const res = await fetch(`/api/workshop/holiday-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "denied",
          adminNotes: notes,
        }),
      });

      if (res.ok) {
        await loadRequests();
        setAdminNotes((prev) => {
          const updated = { ...prev };
          delete updated[requestId];
          return updated;
        });
      } else {
        alert("Failed to deny request");
      }
    } catch (error) {
      console.error("Failed to deny:", error);
      alert("Error denying request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (requestId: string) => {
    if (!confirm("Are you sure you want to delete this holiday request?")) return;
    if (processingId) return;

    setProcessingId(requestId);
    try {
      const res = await fetch(`/api/workshop/holiday-requests/${requestId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await loadRequests();
      } else {
        alert("Failed to delete request");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Error deleting request");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-600 bg-green-50";
      case "denied":
        return "text-red-600 bg-red-50";
      case "pending":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-slate-600 bg-slate-50";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Holiday Requests</h2>
          <p className="text-muted-foreground text-sm">Approve, deny, and manage team holiday requests.</p>
        </div>
        <Select value={filter} onValueChange={(val) => setFilter(val as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">Loading requests...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center text-muted-foreground">No holiday requests found.</div>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map((req) => (
            <Card key={req.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{formatDate(req.startDate)}</span>
                    <span>→</span>
                    <span>{formatDate(req.endDate)}</span>
                    <span className="text-xs text-muted-foreground">({req.days} days)</span>
                  </div>
                  <div className="text-lg font-semibold">{req.user.name || req.user.email}</div>
                  <div className="text-sm text-muted-foreground">Allowance: {req.user.holidayAllowance} days</div>
                  {req.reason && <div className="mt-2 text-sm">Reason: {req.reason}</div>}
                  <div className="mt-3 text-sm">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Admin notes</div>
                    <Textarea
                      value={adminNotes[req.id] || ""}
                      onChange={(e) => setAdminNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                      placeholder="Optional notes for approval/denial"
                    />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(req.status)}`}>
                    {req.status.toUpperCase()}
                  </span>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>Used: {balances[req.userId]?.used ?? 0}d</div>
                    <div>Remaining: {balances[req.userId]?.remaining ?? req.user.holidayAllowance}d</div>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(req.id)}
                      disabled={processingId === req.id}
                    >
                      Delete
                    </Button>
                    {req.status !== "approved" && (
                      <Button
                        size="sm"
                        onClick={() => handleApprove(req.id)}
                        disabled={processingId === req.id}
                      >
                        Approve
                      </Button>
                    )}
                    {req.status !== "denied" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeny(req.id)}
                        disabled={processingId === req.id}
                      >
                        Deny
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const TAB_TIME = "time-tracking";
const TAB_HOLIDAYS = "holidays";

function TimeTrackingSettingsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams?.get("tab") === TAB_HOLIDAYS ? TAB_HOLIDAYS : TAB_TIME;
  const [tab, setTab] = useState<string>(initialTab);

  useEffect(() => {
    router.replace(`?tab=${tab}`, { scroll: false });
  }, [tab, router]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Time Tracking & Holidays</h1>
          <p className="text-muted-foreground">Manage timesheets, approvals, and holiday requests in one place.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="bg-white/80 border shadow-sm">
          <TabsTrigger value={TAB_TIME}>Time Tracking</TabsTrigger>
          <TabsTrigger value={TAB_HOLIDAYS}>Holidays</TabsTrigger>
        </TabsList>

        <TabsContent value={TAB_TIME} className="space-y-4">
          <div className="rounded-xl border bg-white/90 shadow-sm">
            <TimesheetsManagement redirectAdminsToSettings={false} />
          </div>
        </TabsContent>

        <TabsContent value={TAB_HOLIDAYS} className="space-y-4">
          <HolidayRequestsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function TimeTrackingSettingsPage() {
  return (
    <Suspense>
      <TimeTrackingSettingsPageInner />
    </Suspense>
  );
}
