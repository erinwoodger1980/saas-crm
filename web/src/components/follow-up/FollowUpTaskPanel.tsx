// web/src/components/follow-up/FollowUpTaskPanel.tsx
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Send, 
  Mail, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  RefreshCw,
  X
} from "lucide-react";
import { AiEmailDraftCard } from "./AiEmailDraftCard";
import { EmailConversationThread } from "./EmailConversationThread";
import { SuggestedActions } from "./SuggestedActions";
import { apiFetch } from "@/lib/api";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  taskType?: string;
  dueAt?: string | null;
  meta?: {
    recipientEmail?: string;
    recipientName?: string;
    aiDraft?: {
      subject: string;
      body: string;
      confidence: number;
      generatedAt: string;
      reasoning?: string;
    };
    emailSent?: boolean;
    sentAt?: string;
    trigger?: string;
  } | null;
};

type Props = {
  task: Task;
  authHeaders: Record<string, string>;
  onEmailSent?: () => void;
  onTaskCompleted?: () => void;
  onClose?: () => void;
};

export function FollowUpTaskPanel({ 
  task, 
  authHeaders, 
  onEmailSent,
  onTaskCompleted,
  onClose 
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showConversation, setShowConversation] = useState(true);
  const [localDraft, setLocalDraft] = useState(task.meta?.aiDraft);
  const [error, setError] = useState<string | null>(null);

  const meta = task.meta || {};
  const recipientEmail = meta.recipientEmail || "";
  const recipientName = meta.recipientName || "";
  const emailSent = meta.emailSent || false;

  useEffect(() => {
    if (task.meta?.aiDraft) {
      setLocalDraft(task.meta.aiDraft);
    }
  }, [task.meta?.aiDraft]);

  const generateDraft = async () => {
    try {
      setGenerating(true);
      setError(null);
      const data = await apiFetch<{ ok: boolean; draft: any }>(
        `/tasks/${task.id}/generate-draft`,
        {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          json: {
            recipientEmail: recipientEmail,
            recipientName: recipientName,
            purpose: "custom",
            tone: "professional",
          },
        }
      );
      setLocalDraft(data.draft);
    } catch (e: any) {
      setError(e.message || "Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  };

  const sendEmail = async (subject: string, body: string) => {
    try {
      setSending(true);
      setError(null);
      await apiFetch(
        `/tasks/${task.id}/send-email`,
        {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          json: {
            subject,
            body,
            to: recipientEmail,
          },
        }
      );
      onEmailSent?.();
      setShowConversation(true);
    } catch (e: any) {
      setError(e.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const completeTask = async () => {
    try {
      setCompleting(true);
      await apiFetch(
        `/tasks/${task.id}`,
        {
          method: "PATCH",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          json: { status: "DONE" },
        }
      );
      onTaskCompleted?.();
    } catch (e: any) {
      setError(e.message || "Failed to complete task");
    } finally {
      setCompleting(false);
    }
  };

  const handleSuggestedAction = async (action: string) => {
    switch (action) {
      case "send_draft":
        if (localDraft) {
          await sendEmail(localDraft.subject, localDraft.body);
        }
        break;
      case "generate_draft":
        await generateDraft();
        break;
      case "draft_response":
        await generateDraft();
        break;
      case "send_followup":
        await generateDraft();
        break;
      default:
        console.log("Unhandled action:", action);
    }
  };

  const priorityColor = {
    LOW: "bg-slate-100 text-slate-800",
    MEDIUM: "bg-blue-100 text-blue-800",
    HIGH: "bg-orange-100 text-orange-800",
    URGENT: "bg-red-100 text-red-800",
  }[task.priority];

  const statusIcon = {
    OPEN: <Clock className="h-4 w-4" />,
    IN_PROGRESS: <Mail className="h-4 w-4" />,
    DONE: <CheckCircle2 className="h-4 w-4" />,
    BLOCKED: <AlertCircle className="h-4 w-4" />,
    CANCELLED: <X className="h-4 w-4" />,
  }[task.status];

  return (
    <div className="space-y-4">
      {/* Close Button - Always visible at top */}
      {onClose && (
        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Task Details</h2>
          <Button 
            onClick={onClose} 
            variant="outline" 
            size="sm"
            className="hover:bg-slate-100"
          >
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
        </div>
      )}

      {/* Task Header */}
      <Card className="border-2 border-indigo-300 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-indigo-600 text-white">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {task.taskType === 'FOLLOW_UP' ? 'Email Follow-up' : 
                   meta.trigger === 'quote_sent' ? 'Quote Follow-up' :
                   meta.trigger === 'lead_created' ? 'New Lead Response' :
                   'AI Follow-Up'}
                </Badge>
                <Badge variant="outline" className={priorityColor}>
                  {task.priority}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  {statusIcon}
                  {task.status}
                </Badge>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">{task.title}</h2>
              {task.description && (
                <p className="text-sm text-slate-600 mt-1">{task.description}</p>
              )}
              {meta.trigger && (
                <p className="text-xs text-indigo-600 mt-1">
                  Triggered by: {meta.trigger.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
              )}
              {task.dueAt && (
                <p className="text-xs text-slate-500 mt-2">
                  Due: {new Date(task.dueAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {recipientEmail && (
            <div className="flex items-center gap-2 text-sm bg-white rounded-lg p-3 border border-slate-200">
              <Mail className="h-4 w-4 text-slate-600" />
              <span className="text-slate-600">To:</span>
              <span className="font-medium text-slate-900">
                {recipientName && `${recipientName} `}
                {`<${recipientEmail}>`}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </Card>
      )}

      {/* Suggested Actions */}
      {task.status !== "DONE" && task.status !== "CANCELLED" && (
        <SuggestedActions
          taskId={task.id}
          authHeaders={authHeaders}
          onAction={handleSuggestedAction}
        />
      )}

      {/* AI Draft or Generate Button */}
      {!emailSent && (
        <>
          {localDraft ? (
            <AiEmailDraftCard
              draft={localDraft}
              recipientEmail={recipientEmail}
              recipientName={recipientName}
              onSend={sendEmail}
              onRegenerate={generateDraft}
              sending={sending}
            />
          ) : (
            <Card className="p-6 border-dashed border-2 border-slate-300">
              <div className="text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                <h3 className="font-semibold text-slate-900 mb-2">
                  No AI draft yet
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Generate a personalized email draft using AI
                </p>
                <Button
                  onClick={generateDraft}
                  disabled={generating}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate AI Draft
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Email Conversation Thread - Always visible for context */}
      <div className="border-t pt-4">
        <Button
          onClick={() => setShowConversation(!showConversation)}
          variant="outline"
          size="sm"
          className="w-full mb-3"
        >
          <Mail className="h-4 w-4 mr-2" />
          {showConversation ? "Hide" : "Show"} Email History
        </Button>
        
        {showConversation && (
          <EmailConversationThread
            taskId={task.id}
            authHeaders={authHeaders}
          />
        )}
      </div>

      {/* Complete Task Button */}
      {task.status !== "DONE" && task.status !== "CANCELLED" && emailSent && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-900">
                Email sent successfully!
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                Mark this task as complete to move it off your list.
              </p>
            </div>
            <Button
              onClick={completeTask}
              disabled={completing}
              className="bg-green-600 hover:bg-green-700"
            >
              {completing ? (
                "Completing..."
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete Task
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Close Button for Small Screens */}
      {onClose && (
        <div className="sticky bottom-0 pt-4 pb-2 bg-white border-t">
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full"
          >
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
