"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Clock, Calendar, TrendingUp, User } from "lucide-react";

type TimeEntry = {
  id: string;
  devTaskId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  notes: string | null;
  devTask: {
    id: string;
    title: string;
    status: string;
    priority: string;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

type TaskSummary = {
  task: any;
  entries: TimeEntry[];
  totalMs: number;
  totalHours: number;
};

type UserSummary = {
  user: any;
  entries: TimeEntry[];
  totalMs: number;
  totalHours: number;
};

type TimeSummary = {
  ok: boolean;
  entries: TimeEntry[];
  byTask: TaskSummary[];
  byUser: UserSummary[];
  totalMs: number;
  totalHours: number;
};

export default function TimeTrackingPage() {
  const [summary, setSummary] = useState<TimeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewMode, setViewMode] = useState<"tasks" | "users" | "entries">("tasks");

  useEffect(() => {
    // Default to current week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    setStartDate(weekStart.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
    
    loadSummary();
  }, []);

  async function loadSummary() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      
      const data = await apiFetch<TimeSummary>(`/dev/time-entries/summary?${params.toString()}`);
      if (data.ok) setSummary(data);
    } catch (e) {
      console.error("Failed to load time summary:", e);
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  }

  function formatDateTime(date: string): string {
    return new Date(date).toLocaleString();
  }

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Time Tracking Dashboard</h1>
          <p className="text-sm text-gray-600">Track time spent on developer tasks</p>
        </div>
        <a 
          href="/admin/dev-console" 
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          ← Back to Console
        </a>
      </header>

      {/* Filters */}
      <section className="rounded border bg-white p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>
          <button
            onClick={loadSummary}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Apply Filter
          </button>
        </div>
      </section>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded border bg-white p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Total Time</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {summary.totalHours.toFixed(1)}h
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatDuration(summary.totalMs)}
            </div>
          </div>

          <div className="rounded border bg-white p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Tasks Tracked</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {summary.byTask.length}
            </div>
          </div>

          <div className="rounded border bg-white p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <User className="h-4 w-4" />
              <span className="text-sm font-medium">Active Users</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {summary.byUser.length}
            </div>
          </div>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setViewMode("tasks")}
          className={`px-4 py-2 border-b-2 ${viewMode === "tasks" ? "border-purple-600 text-purple-600" : "border-transparent"}`}
        >
          By Task
        </button>
        <button
          onClick={() => setViewMode("users")}
          className={`px-4 py-2 border-b-2 ${viewMode === "users" ? "border-purple-600 text-purple-600" : "border-transparent"}`}
        >
          By User
        </button>
        <button
          onClick={() => setViewMode("entries")}
          className={`px-4 py-2 border-b-2 ${viewMode === "entries" ? "border-purple-600 text-purple-600" : "border-transparent"}`}
        >
          All Entries
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : !summary ? (
        <div className="text-center py-12 text-gray-500">Failed to load data</div>
      ) : (
        <>
          {viewMode === "tasks" && (
            <div className="space-y-4">
              {summary.byTask.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No time entries found</div>
              ) : (
                summary.byTask.map((taskSummary) => (
                  <div key={taskSummary.task.id} className="rounded border bg-white p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{taskSummary.task.title}</h3>
                        <div className="flex gap-3 text-sm text-gray-600 mt-1">
                          <span className="px-2 py-0.5 bg-gray-100 rounded">
                            {taskSummary.task.status}
                          </span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {taskSummary.task.priority}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-purple-600">
                          {taskSummary.totalHours.toFixed(1)}h
                        </div>
                        <div className="text-xs text-gray-500">
                          {taskSummary.entries.length} entries
                        </div>
                      </div>
                    </div>
                    
                    {/* Entry details */}
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                        View entries
                      </summary>
                      <div className="mt-2 space-y-2">
                        {taskSummary.entries.map((entry) => (
                          <div key={entry.id} className="text-sm border-l-2 border-gray-200 pl-3 py-1">
                            <div className="flex justify-between">
                              <span className="text-gray-600">{entry.user.name || entry.user.email}</span>
                              <span className="font-medium">{formatDuration(entry.durationMs || 0)}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDateTime(entry.startedAt)} → {entry.endedAt ? formatDateTime(entry.endedAt) : 'In progress'}
                            </div>
                            {entry.notes && (
                              <div className="text-xs text-gray-600 mt-1">{entry.notes}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                ))
              )}
            </div>
          )}

          {viewMode === "users" && (
            <div className="space-y-4">
              {summary.byUser.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No time entries found</div>
              ) : (
                summary.byUser.map((userSummary) => (
                  <div key={userSummary.user.id} className="rounded border bg-white p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{userSummary.user.name || userSummary.user.email}</h3>
                        <div className="text-sm text-gray-600">{userSummary.user.email}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-600">
                          {userSummary.totalHours.toFixed(1)}h
                        </div>
                        <div className="text-xs text-gray-500">
                          {userSummary.entries.length} entries
                        </div>
                      </div>
                    </div>
                    
                    {/* Entry details */}
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                        View entries
                      </summary>
                      <div className="mt-2 space-y-2">
                        {userSummary.entries.map((entry) => (
                          <div key={entry.id} className="text-sm border-l-2 border-gray-200 pl-3 py-1">
                            <div className="flex justify-between">
                              <span className="font-medium">{entry.devTask.title}</span>
                              <span className="font-medium">{formatDuration(entry.durationMs || 0)}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDateTime(entry.startedAt)} → {entry.endedAt ? formatDateTime(entry.endedAt) : 'In progress'}
                            </div>
                            {entry.notes && (
                              <div className="text-xs text-gray-600 mt-1">{entry.notes}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                ))
              )}
            </div>
          )}

          {viewMode === "entries" && (
            <div className="rounded border bg-white">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Task</th>
                    <th className="text-left p-3 text-sm font-medium">User</th>
                    <th className="text-left p-3 text-sm font-medium">Started</th>
                    <th className="text-left p-3 text-sm font-medium">Ended</th>
                    <th className="text-right p-3 text-sm font-medium">Duration</th>
                    <th className="text-left p-3 text-sm font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summary.entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500">
                        No time entries found
                      </td>
                    </tr>
                  ) : (
                    summary.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="p-3 text-sm">
                          <div className="font-medium">{entry.devTask.title}</div>
                          <div className="text-xs text-gray-500">
                            {entry.devTask.status} • {entry.devTask.priority}
                          </div>
                        </td>
                        <td className="p-3 text-sm">
                          {entry.user.name || entry.user.email}
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {formatDateTime(entry.startedAt)}
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {entry.endedAt ? formatDateTime(entry.endedAt) : (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                              In progress
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-right font-medium">
                          {formatDuration(entry.durationMs || 0)}
                        </td>
                        <td className="p-3 text-sm text-gray-600 max-w-xs truncate">
                          {entry.notes || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
