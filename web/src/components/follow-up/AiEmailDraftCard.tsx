// web/src/components/follow-up/AiEmailDraftCard.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Edit, RefreshCw, Mail } from "lucide-react";

type AiDraft = {
  subject: string;
  body: string;
  confidence: number;
  generatedAt: string;
  reasoning?: string;
};

type Props = {
  draft: AiDraft;
  onEdit?: (subject: string, body: string) => void;
  onSend?: (subject: string, body: string) => void;
  onRegenerate?: () => void;
  recipientEmail?: string;
  recipientName?: string;
  sending?: boolean;
};

export function AiEmailDraftCard({
  draft,
  onEdit,
  onSend,
  onRegenerate,
  recipientEmail,
  recipientName,
  sending = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState(draft.subject);
  const [editedBody, setEditedBody] = useState(draft.body);

  const confidenceColor =
    draft.confidence >= 0.8 ? "bg-green-100 text-green-800 border-green-200" :
    draft.confidence >= 0.6 ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
    "bg-orange-100 text-orange-800 border-orange-200";

  const confidenceLabel =
    draft.confidence >= 0.8 ? "High confidence" :
    draft.confidence >= 0.6 ? "Good confidence" :
    "Review recommended";

  const handleSave = () => {
    onEdit?.(editedSubject, editedBody);
    setEditing(false);
  };

  const handleSend = () => {
    if (editing) {
      onSend?.(editedSubject, editedBody);
    } else {
      onSend?.(draft.subject, draft.body);
    }
  };

  return (
    <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-100">
              <Sparkles className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">AI-Generated Email Draft</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {recipientName && `For ${recipientName}`}
                {recipientEmail && ` (${recipientEmail})`}
              </p>
            </div>
          </div>
          <Badge className={`${confidenceColor} border`}>
            {confidenceLabel}
          </Badge>
        </div>

        {/* Draft Content */}
        <div className="space-y-3 bg-white rounded-lg p-4 border border-slate-200">
          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
              Subject
            </label>
            {editing ? (
              <input
                type="text"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            ) : (
              <p className="mt-1 font-medium text-slate-900">{draft.subject}</p>
            )}
          </div>

          {/* Body */}
          <div>
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
              Message
            </label>
            {editing ? (
              <textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={12}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
              />
            ) : (
              <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                {draft.body}
              </div>
            )}
          </div>
        </div>

        {/* AI Reasoning (if available) */}
        {draft.reasoning && !editing && (
          <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
            <p className="text-xs font-medium text-indigo-900 mb-1">AI Reasoning:</p>
            <p className="text-xs text-indigo-700">{draft.reasoning}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button
                onClick={handleSave}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
              <Button
                onClick={() => {
                  setEditedSubject(draft.subject);
                  setEditedBody(draft.body);
                  setEditing(false);
                }}
                variant="ghost"
                size="sm"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleSend}
                disabled={sending}
                size="sm"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? "Sending..." : "Send Email"}
              </Button>
              <Button
                onClick={() => setEditing(true)}
                variant="outline"
                size="sm"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              {onRegenerate && (
                <Button
                  onClick={onRegenerate}
                  variant="ghost"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-xs text-slate-500 text-center">
          Generated {new Date(draft.generatedAt).toLocaleString()}
        </p>
      </div>
    </Card>
  );
}
