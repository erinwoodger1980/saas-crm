"use client";

import { useEffect, useState } from "react";
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

export default function HolidayManagementPage() {
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

        // Load balances for each unique user
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
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Holiday Management</h1>
        <p className="text-gray-600">Review and manage employee holiday requests</p>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : filteredRequests.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No {filter !== "all" ? filter : ""} holiday requests found
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const balance = balances[request.userId];
            return (
              <Card key={request.id} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* User Info */}
                  <div className="md:col-span-3">
                    <div className="font-semibold">{request.user.name || "Unknown"}</div>
                    <div className="text-sm text-gray-500">{request.user.email}</div>
                    {balance && (
                      <div className="text-xs text-gray-600 mt-1">
                        Balance: {balance.remaining}/{balance.allowance} days
                      </div>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="md:col-span-3">
                    <div className="text-sm text-gray-500">Dates</div>
                    <div className="font-medium">
                      {formatDate(request.startDate)} - {formatDate(request.endDate)}
                    </div>
                    <div className="text-sm text-gray-600">{request.days} day{request.days !== 1 ? "s" : ""}</div>
                  </div>

                  {/* Reason */}
                  <div className="md:col-span-3">
                    <div className="text-sm text-gray-500">Reason</div>
                    <div className="text-sm">{request.reason || "—"}</div>
                    {request.adminNotes && (
                      <div className="text-xs text-gray-500 mt-1 italic">
                        Admin: {request.adminNotes}
                      </div>
                    )}
                  </div>

                  {/* Status & Actions */}
                  <div className="md:col-span-3">
                    <div className="mb-2">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          request.status
                        )}`}
                      >
                        {request.status.toUpperCase()}
                      </span>
                    </div>

                    {request.status === "pending" && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Admin notes (optional for approval, required for denial)"
                          value={adminNotes[request.id] || ""}
                          onChange={(e) =>
                            setAdminNotes((prev) => ({
                              ...prev,
                              [request.id]: e.target.value,
                            }))
                          }
                          className="text-xs h-16"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleApprove(request.id)}
                            disabled={processingId === request.id}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1"
                            size="sm"
                          >
                            ✓ Approve
                          </Button>
                          <Button
                            onClick={() => handleDeny(request.id)}
                            disabled={processingId === request.id}
                            variant="destructive"
                            className="text-xs px-3 py-1"
                            size="sm"
                          >
                            ✗ Deny
                          </Button>
                        </div>
                      </div>
                    )}

                    {request.status !== "pending" && (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500">
                          {request.approvedAt ? `Processed: ${formatDate(request.approvedAt)}` : ""}
                        </div>
                        <Button
                          onClick={() => handleDelete(request.id)}
                          disabled={processingId === request.id}
                          variant="outline"
                          className="text-xs px-3 py-1"
                          size="sm"
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
