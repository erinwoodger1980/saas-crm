"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Check, X, Download, Calendar } from "lucide-react";

type Timesheet = {
  id: string;
  userId: string;
  weekStartDate: string;
  weekEndDate: string;
  totalHours: number;
  status: string;
  signedOffAt: string | null;
  notes: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    workshopColor?: string;
  };
  signedOffBy?: {
    id: string;
    name: string;
    email: string;
  };
};

type User = {
  id: string;
  name: string;
  email: string;
};

export default function TimesheetsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  async function loadTimesheets() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUser !== "all") params.append("userId", filterUser);
      if (filterStatus !== "all") params.append("status", filterStatus);

      const data = await apiFetch<{ ok: boolean; items: Timesheet[] }>(
        `/timesheets?${params.toString()}`
      );

      if (data.ok) {
        setTimesheets(data.items);
      }
    } catch (e: any) {
      console.error("Failed to load timesheets:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await apiFetch<{ ok: boolean; items: User[] }>("/auth/users");
      if (data.ok) {
        setUsers(data.items);
      }
    } catch (e: any) {
      console.error("Failed to load users:", e);
    }
  }

  async function signOff(timesheetId: string) {
    const confirmed = confirm("Sign off this timesheet?");
    if (!confirmed) return;

    try {
      const data = await apiFetch<{ ok: boolean }>(
        `/timesheets/${timesheetId}/sign-off`,
        { method: "POST" }
      );

      if (data.ok) {
        loadTimesheets();
      }
    } catch (e: any) {
      alert("Failed to sign off: " + (e?.message || "Unknown error"));
    }
  }

  async function reject(timesheetId: string) {
    const notes = prompt("Reason for rejection:");
    if (!notes) return;

    try {
      const data = await apiFetch<{ ok: boolean }>(
        `/timesheets/${timesheetId}/reject`,
        { method: "POST", json: { notes } }
      );

      if (data.ok) {
        loadTimesheets();
      }
    } catch (e: any) {
      alert("Failed to reject: " + (e?.message || "Unknown error"));
    }
  }

  async function exportPayroll() {
    try {
      window.open("/api/timesheets/export/payroll", "_blank");
    } catch (e: any) {
      alert("Failed to export: " + (e?.message || "Unknown error"));
    }
  }

  useEffect(() => {
    loadTimesheets();
    loadUsers();
  }, [filterUser, filterStatus]);

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "signed_off":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Signed Off</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="w-8 h-8" />
            Timesheets
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and sign off workshop hours for payroll
          </p>
        </div>
        <Button onClick={exportPayroll} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Payroll CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Filter by User</label>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Filter by Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="signed_off">Signed Off</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={loadTimesheets}>Refresh</Button>
          </div>
        </div>
      </Card>

      {/* Timesheets List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading timesheets...</div>
      ) : timesheets.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground">No timesheets found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Timesheets are automatically created when users log workshop hours
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {timesheets.map((ts) => (
            <Card key={ts.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: ts.user.workshopColor || "#3b82f6" }}
                  >
                    {(ts.user.name || ts.user.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{ts.user.name || ts.user.email}</h3>
                    <p className="text-sm text-muted-foreground">
                      Week: {formatDate(ts.weekStartDate)} - {formatDate(ts.weekEndDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(ts.status)}
                  <div className="text-right">
                    <div className="text-3xl font-bold text-blue-600">{ts.totalHours}h</div>
                    <div className="text-xs text-muted-foreground">Total Hours</div>
                  </div>
                </div>
              </div>

              {ts.signedOffBy && (
                <div className="text-sm text-muted-foreground mb-4">
                  Signed off by {ts.signedOffBy.name} on {formatDate(ts.signedOffAt!)}
                </div>
              )}

              {ts.notes && (
                <div className="text-sm bg-slate-50 p-3 rounded mb-4">
                  <strong>Notes:</strong> {ts.notes}
                </div>
              )}

              {ts.status === "pending" && (
                <div className="flex gap-2">
                  <Button onClick={() => signOff(ts.id)} size="sm" className="bg-green-600 hover:bg-green-700">
                    <Check className="w-4 h-4 mr-2" />
                    Sign Off
                  </Button>
                  <Button onClick={() => reject(ts.id)} size="sm" variant="outline">
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
