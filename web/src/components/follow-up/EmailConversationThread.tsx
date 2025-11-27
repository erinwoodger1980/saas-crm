// web/src/components/follow-up/EmailConversationThread.tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, Mail } from "lucide-react";
import { apiFetch } from "@/lib/api";

type EmailMessage = {
  id: string;
  messageId: string;
  threadId: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  body: string;
  direction: "SENT" | "RECEIVED";
  timestamp: string;
  inReplyTo?: string | null;
};

type Props = {
  taskId: string;
  authHeaders: Record<string, string>;
};

export function EmailConversationThread({ taskId, authHeaders }: Props) {
  const [conversation, setConversation] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConversation() {
      try {
        setLoading(true);
        const data = await apiFetch<{ ok: boolean; conversation: EmailMessage[] }>(
          `/tasks/${taskId}/conversation`,
          { headers: authHeaders }
        );
        setConversation(data.conversation || []);
      } catch (e: any) {
        setError(e.message || "Failed to load conversation");
      } finally {
        setLoading(false);
      }
    }

    if (taskId) {
      loadConversation();
    }
  }, [taskId, authHeaders]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-slate-600">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          Loading conversation...
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <p className="text-sm text-red-800">{error}</p>
      </Card>
    );
  }

  if (conversation.length === 0) {
    return (
      <Card className="p-6 border-slate-200">
        <div className="text-center text-slate-500">
          <Mail className="h-8 w-8 mx-auto mb-2 text-slate-400" />
          <p className="text-sm">No messages in this conversation yet.</p>
          <p className="text-xs mt-1">Send the email above to start the conversation.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <Mail className="h-4 w-4" />
        Email Conversation ({conversation.length})
      </h3>
      
      <div className="space-y-3">
        {conversation.map((msg) => (
          <Card
            key={msg.id}
            className={`p-4 ${
              msg.direction === "SENT"
                ? "border-blue-200 bg-blue-50 ml-8"
                : "border-green-200 bg-green-50 mr-8"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg ${
                  msg.direction === "SENT" ? "bg-blue-100" : "bg-green-100"
                }`}
              >
                {msg.direction === "SENT" ? (
                  <ArrowUpRight className="h-4 w-4 text-blue-600" />
                ) : (
                  <ArrowDownLeft className="h-4 w-4 text-green-600" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={msg.direction === "SENT" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {msg.direction === "SENT" ? "You sent" : "They replied"}
                    </Badge>
                    <span className="text-xs text-slate-600">
                      {new Date(msg.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 mb-1">
                  <span className="font-medium">From:</span> {msg.fromAddress}
                </div>
                <div className="text-xs text-slate-600 mb-2">
                  <span className="font-medium">To:</span> {msg.toAddress}
                </div>

                <div className="font-medium text-sm text-slate-900 mb-2">
                  {msg.subject}
                </div>

                <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white rounded-lg p-3 border border-slate-200">
                  {msg.body}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
