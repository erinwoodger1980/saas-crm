// web/src/components/tasks/TaskAnalyticsDashboard.tsx
"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Calendar,
  Target,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type TaskAnalytics = {
  overview: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    avgCompletionTime: number; // in hours
    completionRate: number; // percentage
  };
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  byUser: Array<{
    userId: string;
    userName: string;
    completed: number;
    pending: number;
    avgCompletionTime: number;
  }>;
  timeline: Array<{
    date: string;
    created: number;
    completed: number;
  }>;
  trends: {
    completionRateTrend: number; // percentage change
    avgTimeTrend: number; // percentage change
    volumeTrend: number; // percentage change
  };
};

const COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: COLORS.primary,
  IN_PROGRESS: COLORS.warning,
  COMPLETED: COLORS.success,
  BLOCKED: COLORS.danger,
};

export function TaskAnalyticsDashboard() {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";

  const [analytics, setAnalytics] = useState<TaskAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30"); // days
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [tenantId, timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/tasks/analytics?days=${timeRange}`, {
        headers: { "x-tenant-id": tenantId },
      });
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await apiFetch(`/tasks/analytics/export?days=${timeRange}`, {
        headers: { "x-tenant-id": tenantId },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `task-analytics-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to export analytics:", error);
      alert("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  const statusData = Object.entries(analytics.byStatus).map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLORS[name] || COLORS.primary,
  }));

  const priorityData = Object.entries(analytics.byPriority).map(([name, value]) => ({
    name,
    value,
  }));

  const typeData = Object.entries(analytics.byType).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Task Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Performance insights and metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport} disabled={exporting} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{analytics.overview.totalTasks}</div>
              <div className="text-xs text-muted-foreground">Total Tasks</div>
            </div>
          </div>
          {analytics.trends.volumeTrend !== 0 && (
            <div
              className={`flex items-center gap-1 mt-2 text-xs ${
                analytics.trends.volumeTrend > 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              <TrendingUp className="h-3 w-3" />
              {Math.abs(analytics.trends.volumeTrend).toFixed(1)}% vs prev period
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{analytics.overview.completedTasks}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {analytics.overview.completionRate.toFixed(1)}% completion rate
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{analytics.overview.overdueTasks}</div>
              <div className="text-xs text-muted-foreground">Overdue</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {analytics.overview.avgCompletionTime.toFixed(1)}h
              </div>
              <div className="text-xs text-muted-foreground">Avg Time</div>
            </div>
          </div>
          {analytics.trends.avgTimeTrend !== 0 && (
            <div
              className={`flex items-center gap-1 mt-2 text-xs ${
                analytics.trends.avgTimeTrend < 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              <TrendingUp className="h-3 w-3" />
              {Math.abs(analytics.trends.avgTimeTrend).toFixed(1)}% vs prev period
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <BarChart3 className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {analytics.overview.completionRate.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">Success Rate</div>
            </div>
          </div>
          {analytics.trends.completionRateTrend !== 0 && (
            <div
              className={`flex items-center gap-1 mt-2 text-xs ${
                analytics.trends.completionRateTrend > 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              <TrendingUp className="h-3 w-3" />
              {Math.abs(analytics.trends.completionRateTrend).toFixed(1)}% vs prev period
            </div>
          )}
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Timeline Chart */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Task Timeline
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="created"
                stroke={COLORS.primary}
                name="Created"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="completed"
                stroke={COLORS.success}
                name="Completed"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Status Distribution */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Task Status Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Tasks by Priority</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={priorityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill={COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Type Distribution */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Tasks by Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill={COLORS.purple} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* User Performance Table */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Performance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 text-sm font-semibold">User</th>
                <th className="text-right p-3 text-sm font-semibold">Completed</th>
                <th className="text-right p-3 text-sm font-semibold">Pending</th>
                <th className="text-right p-3 text-sm font-semibold">Avg Time (hrs)</th>
                <th className="text-right p-3 text-sm font-semibold">Completion Rate</th>
              </tr>
            </thead>
            <tbody>
              {analytics.byUser.map((user) => {
                const total = user.completed + user.pending;
                const rate = total > 0 ? (user.completed / total) * 100 : 0;
                return (
                  <tr key={user.userId} className="border-b hover:bg-slate-50">
                    <td className="p-3 text-sm">{user.userName}</td>
                    <td className="p-3 text-sm text-right text-green-600 font-medium">
                      {user.completed}
                    </td>
                    <td className="p-3 text-sm text-right text-gray-600">
                      {user.pending}
                    </td>
                    <td className="p-3 text-sm text-right">
                      {user.avgCompletionTime.toFixed(1)}
                    </td>
                    <td className="p-3 text-sm text-right">
                      <div
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          rate >= 80
                            ? "bg-green-100 text-green-800"
                            : rate >= 60
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {rate.toFixed(0)}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
