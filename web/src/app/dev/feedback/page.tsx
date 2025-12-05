"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MessageSquare, Filter, Mail, CheckCircle2 } from "lucide-react";

type Feedback = {
  id: string;
  feature: string;
  rating: number | null;
  comment: string | null;
  status: string;
  priority: string;
  category: string | null;
  devNotes: string | null;
  devResponse: string | null;
  devScreenshotUrls: string[];
  linkedTaskId: string | null;
  emailNotificationSent: boolean;
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
    status: searchParams?.get("status") || "all",
    priority: searchParams?.get("priority") || "all",
    category: searchParams?.get("category") || "",
    tenantId: searchParams?.get("tenantId") || ""
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [uploadingScreenshot, setUploadingScreenshot] = useState<string | null>(null);
  const [tenantUsers, setTenantUsers] = useState<Record<string, any[]>>({});
  const [recipientByFeedback, setRecipientByFeedback] = useState<Record<string, string>>({});
  // Fetch users for a tenant if not already loaded
  async function loadTenantUsers(tenantId: string) {
    if (tenantUsers[tenantId]) return;
    try {
      const res = await apiFetch<{ ok: boolean; tenant: { users: any[] } }>(`/tenants/${tenantId}`);
      if (res.ok) {
        setTenantUsers(prev => ({ ...prev, [tenantId]: res.tenant.users }));
      }
    } catch (e) {
      // ignore
    }
  }

  async function loadFeedback() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== "all") params.append("status", filters.status);
      if (filters.priority && filters.priority !== "all") params.append("priority", filters.priority);
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

  function sendEmailNotification(feedbackId: string) {
    try {
      // Find the selected recipient and feedback details
      const feedback = feedbacks.find(f => f.id === feedbackId);
      if (!feedback) {
        alert("Feedback not found");
        return;
      }

      const recipientUserId = recipientByFeedback[feedbackId] || feedback?.user?.id;
      const recipientUser = recipientUserId 
        ? (tenantUsers[feedback.tenant.id] || []).find(u => u.id === recipientUserId) || feedback.user
        : feedback.user;

      if (!recipientUser?.email) {
        alert("No email address found for selected recipient");
        return;
      }

      // Construct feedback URL
      const feedbackUrl = `${window.location.origin}/feedback?highlight=${feedback.id}`;

      // Build email subject
      const subject = `Update on your feedback: ${feedback.feature}`;

      // Build plain text email body
      let body = `Hi ${recipientUser.name || 'there'},\n\n`;
      body += `We've updated the feedback you submitted for "${feedback.feature}".\n\n`;

      if (feedback.devResponse) {
        body += `Developer Response:\n`;
        body += `${feedback.devResponse}\n\n`;
      }

      if (feedback.devScreenshotUrls && feedback.devScreenshotUrls.length > 0) {
        body += `Screenshots attached (${feedback.devScreenshotUrls.length} image(s)):\n`;
        feedback.devScreenshotUrls.forEach((url, idx) => {
          body += `  ${idx + 1}. ${url}\n`;
        });
        body += `\n`;
      }

      body += `Current Status: ${feedback.status}\n\n`;
      body += `View your feedback here: ${feedbackUrl}\n\n`;
      body += `Thank you for helping us improve!`;

      // Open mailto link - use window.location.href to trigger default email client
      const mailtoUrl = `mailto:${encodeURIComponent(recipientUser.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoUrl;

      // Optionally mark as sent locally (or remove this if you want to track actual sends)
      // setFeedbacks(prev => prev.map(f => 
      //   f.id === feedbackId ? { ...f, emailNotificationSent: true } : f
      // ));
    } catch (e: any) {
      alert("Failed to prepare email: " + e.message);
    }
  }

  async function handleScreenshotUpload(feedbackId: string, files: FileList) {
    setUploadingScreenshot(feedbackId);
    try {
      const uploadPromises = Array.from(files).map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const base64 = e.target?.result as string;
            try {
              const response = await fetch("/api/dev/feedback/upload-screenshot", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${localStorage.getItem("jwt")}`,
                },
                body: JSON.stringify({ screenshot: base64 }),
              });

              if (!response.ok) {
                throw new Error("Failed to upload screenshot");
              }

              const data = await response.json();
              resolve(data.url);
            } catch (e: any) {
              reject(e);
            }
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      // Add all screenshots to the feedback
      for (const screenshotUrl of uploadedUrls) {
        const response = await fetch(`/api/dev/feedback/${feedbackId}/add-screenshot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("jwt")}`,
          },
          body: JSON.stringify({ screenshotUrl }),
        });
        
        if (!response.ok) {
          throw new Error("Failed to add screenshot to feedback");
        }
        
        const feedbackData = await response.json();
        setFeedbacks(prev => prev.map(f => f.id === feedbackId ? feedbackData.feedback : f));
      }
      setEditForm({});
    } catch (e: any) {
      alert("Failed to upload screenshot(s): " + e.message);
    } finally {
      setUploadingScreenshot(null);
    }
  }

  async function removeScreenshot(feedbackId: string, screenshotUrl: string) {
    try {
      const response = await fetch(`/api/dev/feedback/${feedbackId}/remove-screenshot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("jwt")}`,
        },
        body: JSON.stringify({ screenshotUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove screenshot");
      }

      const data = await response.json();
      setFeedbacks(prev => prev.map(f => f.id === feedbackId ? data.feedback : f));
      setEditForm((prev: any) => ({
        ...prev,
        devScreenshotUrls: (prev.devScreenshotUrls || []).filter((url: string) => url !== screenshotUrl)
      }));
    } catch (e: any) {
      alert("Failed to remove screenshot: " + e.message);
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
                <SelectItem value="all">All Statuses</SelectItem>
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
                <SelectItem value="all">All Priorities</SelectItem>
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
            <Button variant="outline" onClick={() => setFilters({ status: "all", priority: "all", category: "", tenantId: "" })} className="mt-5">
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
                  {/* Recipient selection */}
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1.5 block">Send Feedback Email To</label>
                    <Select
                      value={recipientByFeedback[feedback.id] || feedback.user?.id || ""}
                      onValueChange={async (v) => {
                        setRecipientByFeedback(prev => ({ ...prev, [feedback.id]: v }));
                      }}
                      onOpenChange={open => { if (open) loadTenantUsers(feedback.tenant.id); }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select recipient user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(tenantUsers[feedback.tenant.id] || (feedback.user ? [feedback.user] : [])).map((u: any) => (
                          <SelectItem key={u.id} value={u.id} disabled={!u.email}>
                            {u.name || u.email || u.id}
                            {u.email ? ` (${u.email})` : " (No email)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(() => {
                      const selectedUserId = recipientByFeedback[feedback.id] || feedback.user?.id;
                      const selectedUser = selectedUserId 
                        ? (tenantUsers[feedback.tenant.id] || [feedback.user]).find((u: any) => u?.id === selectedUserId)
                        : feedback.user;
                      
                      if (selectedUser && !selectedUser.email) {
                        return <div className="text-xs text-red-500 mt-1">⚠️ Selected user has no email address.</div>;
                      }
                      if (selectedUser?.email) {
                        return <div className="text-xs text-green-600 mt-1">✓ Will send to: {selectedUser.email}</div>;
                      }
                      return null;
                    })()}
                  </div>
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
                    <label className="text-xs text-muted-foreground">Developer Notes (Internal)</label>
                    <Textarea 
                      value={editForm.devNotes !== undefined ? editForm.devNotes : feedback.devNotes || ""}
                      onChange={(e) => setEditForm({...editForm, devNotes: e.target.value})}
                      placeholder="Internal notes about this feedback..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Response to User</label>
                    <Textarea 
                      value={editForm.devResponse !== undefined ? editForm.devResponse : feedback.devResponse || ""}
                      onChange={(e) => setEditForm({...editForm, devResponse: e.target.value})}
                      placeholder="This will be shown to the user who submitted the feedback..."
                      rows={4}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Screenshots (shown to user)</label>
                    <div className="flex gap-2 items-center mt-1">
                      <input 
                        type="file" 
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleScreenshotUpload(feedback.id, e.target.files);
                          }
                        }}
                        disabled={uploadingScreenshot === feedback.id}
                        className="text-xs"
                      />
                      {uploadingScreenshot === feedback.id && (
                        <span className="text-xs text-muted-foreground">Uploading...</span>
                      )}
                    </div>
                    {/* Display uploaded screenshots */}
                    <div className="mt-3 space-y-2">
                      {(editForm.devScreenshotUrls || feedback.devScreenshotUrls || []).map((url: string, idx: number) => (
                        <div key={idx} className="relative inline-block">
                          <img 
                            src={url} 
                            alt={`Screenshot ${idx + 1}`} 
                            className="max-w-xs border rounded"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeScreenshot(feedback.id, url)}
                            className="absolute top-2 right-2 h-6 w-6 p-0"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
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
                      const { [feedback.id]: _, ...rest } = recipientByFeedback;
                      setRecipientByFeedback(rest);
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
                      <div className="text-xs text-muted-foreground mb-1">Developer Notes (Internal):</div>
                      <div className="text-sm">{feedback.devNotes}</div>
                    </div>
                  )}

                  {feedback.devResponse && (
                    <div className="bg-blue-50 p-3 rounded mb-3">
                      <div className="text-xs text-muted-foreground mb-1">Response to User:</div>
                      <div className="text-sm whitespace-pre-wrap">{feedback.devResponse}</div>
                    </div>
                  )}

                  {(feedback.devScreenshotUrls && feedback.devScreenshotUrls.length > 0) && (
                    <div className="mb-3">
                      <div className="text-xs text-muted-foreground mb-2">Screenshots ({feedback.devScreenshotUrls.length}):</div>
                      <div className="space-y-2">
                        {feedback.devScreenshotUrls.map((url, idx) => (
                          <img 
                            key={idx}
                            src={url} 
                            alt={`Developer response screenshot ${idx + 1}`} 
                            className="max-w-md border rounded"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {feedback.linkedTaskId && (
                    <div className="text-xs text-muted-foreground mb-3">
                      Linked Task: {feedback.linkedTaskId}
                    </div>
                  )}

                  {(feedback.devResponse || (feedback.devScreenshotUrls && feedback.devScreenshotUrls.length > 0)) && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => sendEmailNotification(feedback.id)}
                        disabled={!((recipientByFeedback[feedback.id] ? (tenantUsers[feedback.tenant.id] || []).find(u => u.id === recipientByFeedback[feedback.id])?.email : feedback.user?.email))}
                      >
                        <Mail className="w-4 h-4 mr-1" />
                        Open Email to: {recipientByFeedback[feedback.id] ? (tenantUsers[feedback.tenant.id] || []).find(u => u.id === recipientByFeedback[feedback.id])?.email || "No email" : feedback.user?.email || "No email"}
                      </Button>
                      <span className="text-xs text-muted-foreground">Opens in your email client for review</span>
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
