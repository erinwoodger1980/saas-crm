"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MessageSquare, Filter } from "lucide-react";

type Feedback = {
  id: string;
  feature: string;
  rating: number | null;
  comment: string | null;
  status: string;
  priority: string;
  category: string | null;
  devNotes: string | null;
  linkedTaskId: string | null;
  createdAt: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
};

function FeedbackManagementContent() {
  const searchParams = useSearchParams();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: searchParams?.get("status") || "",
    priority: searchParams?.get("priority") || "",
    category: searchParams?.get("category") || "",
    tenantId: searchParams?.get("tenantId") || ""
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  async function loadFeedback() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.priority) params.append("priority", filters.priority);
      if (filters.category) params.append("category", filters.category);
      if (filters.tenantId) params.append("tenantId", filters.tenantId);

      const data = await apiFetch<{ ok: boolean; feedbacks: Feedback[] }>(
        `/dev/feedback?${params.toString()}`
      );
      if (data.ok) setFeedbacks(data.feedbacks);
    } catch (e: any) {
      console.error("Failed to load feedback:", e);
    } finally {
      setLoading(false);
    }
  }

  async function updateFeedback(id: string, updates: any) {
    try {
      const data = await apiFetch<{ ok: boolean; feedback: Feedback }>(
        `/dev/feedback/${id}`,
        { method: "PATCH", json: updates }
      );
      if (data.ok) {
        setFeedbacks(prev => prev.map(f => f.id === id ? data.feedback : f));
        setEditingId(null);
        setEditForm({});
      }
    } catch (e: any) {
      alert("Failed to update feedback: " + e.message);
    }
  }

  useEffect(() => {
    loadFeedback();
  }, [filters]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return "bg-red-100 text-red-700";
      case "HIGH": return "bg-orange-100 text-orange-700";
      case "MEDIUM": return "bg-yellow-100 text-yellow-700";
      case "LOW": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "bg-green-100 text-green-700";
      case "IN_PROGRESS": return "bg-blue-100 text-blue-700";
      case "PLANNED": return "bg-purple-100 text-purple-700";
      case "IN_REVIEW": return "bg-yellow-100 text-yellow-700";
      case "WONT_FIX": return "bg-gray-100 text-gray-700";
      case "DUPLICATE": return "bg-gray-100 text-gray-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="w-8 h-8" />
          User Feedback
        </h1>
        <Button variant="outline" onClick={loadFeedback}>Refresh</Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4" />
          <h2 className="font-medium">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
              <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_REVIEW">In Review</SelectItem>
                <SelectItem value="PLANNED">Planned</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="WONT_FIX">Won't Fix</SelectItem>
                <SelectItem value="DUPLICATE">Duplicate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Priority</label>
            <Select value={filters.priority} onValueChange={(v) => setFilters({...filters, priority: v})}>
              <SelectTrigger><SelectValue placeholder="All Priorities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Priorities</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <Input 
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
              placeholder="e.g., UI, Bug, Feature"
            />
          </div>

          <div>
            <Button variant="outline" onClick={() => setFilters({ status: "", priority: "", category: "", tenantId: "" })} className="mt-5">
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Feedback List */}
      {loading ? (
        <div className="text-muted-foreground">Loading feedback...</div>
      ) : feedbacks.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No feedback found matching your filters.
        </Card>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((feedback) => (
            <Card key={feedback.id} className="p-4">
              {editingId === feedback.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Status</label>
                      <Select 
                        value={editForm.status || feedback.status}
                        onValueChange={(v) => setEditForm({...editForm, status: v})}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OPEN">Open</SelectItem>
                          <SelectItem value="IN_REVIEW">In Review</SelectItem>
                          <SelectItem value="PLANNED">Planned</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                          <SelectItem value="WONT_FIX">Won't Fix</SelectItem>
                          <SelectItem value="DUPLICATE">Duplicate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Priority</label>
                      <Select 
                        value={editForm.priority || feedback.priority}
                        onValueChange={(v) => setEditForm({...editForm, priority: v})}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Category</label>
                      <Input 
                        value={editForm.category !== undefined ? editForm.category : feedback.category || ""}
                        onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                        placeholder="UI, Bug, Feature, etc."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Developer Notes</label>
                    <Textarea 
                      value={editForm.devNotes !== undefined ? editForm.devNotes : feedback.devNotes || ""}
                      onChange={(e) => setEditForm({...editForm, devNotes: e.target.value})}
                      placeholder="Internal notes about this feedback..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Linked Task ID</label>
                    <Input 
                      value={editForm.linkedTaskId !== undefined ? editForm.linkedTaskId : feedback.linkedTaskId || ""}
                      onChange={(e) => setEditForm({...editForm, linkedTaskId: e.target.value})}
                      placeholder="Link to dev task (optional)"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => updateFeedback(feedback.id, editForm)}>Save</Button>
                    <Button variant="ghost" onClick={() => {
                      setEditingId(null);
                      setEditForm({});
                    }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(feedback.priority)}`}>
                          {feedback.priority}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(feedback.status)}`}>
                          {feedback.status}
                        </span>
                        {feedback.category && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                            {feedback.category}
                          </span>
                        )}
                      </div>
                      <div className="font-medium">Feature: {feedback.feature}</div>
                      <div className="text-sm text-muted-foreground">
                        {feedback.tenant.name} ({feedback.tenant.slug}) • {feedback.user?.email || "Anonymous"} • {new Date(feedback.createdAt).toLocaleDateString()}
                      </div>
                      {feedback.rating && (
                        <div className="text-sm mt-1">Rating: {"⭐".repeat(feedback.rating)}</div>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(feedback.id)}>
                      Edit
                    </Button>
                  </div>

                  {feedback.comment && (
                    <div className="bg-slate-50 p-3 rounded mb-3">
                      <div className="text-xs text-muted-foreground mb-1">User Comment:</div>
                      <div className="text-sm">{feedback.comment}</div>
                    </div>
                  )}

                  {feedback.devNotes && (
                    <div className="bg-yellow-50 p-3 rounded mb-3">
                      <div className="text-xs text-muted-foreground mb-1">Developer Notes:</div>
                      <div className="text-sm">{feedback.devNotes}</div>
                    </div>
                  )}

                  {feedback.linkedTaskId && (
                    <div className="text-xs text-muted-foreground">
                      Linked Task: {feedback.linkedTaskId}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FeedbackManagementPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading feedback...</div>}>
      <FeedbackManagementContent />
    </Suspense>
  );
}
