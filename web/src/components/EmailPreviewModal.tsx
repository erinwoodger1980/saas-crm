// web/src/components/EmailPreviewModal.tsx
"use client";

import { useState, useEffect, ReactNode } from "react";
import { Button } from "./ui/button";

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (editedSubject: string, editedBody: string) => Promise<void>;
  subject: string;
  body: string;
  to: string;
  recipientName?: string;
  loading?: boolean;
  note?: ReactNode;
  includeAttachment?: boolean;
  onIncludeAttachmentChange?: (next: boolean) => void;
}

export function EmailPreviewModal({
  isOpen,
  onClose,
  onSend,
  subject,
  body,
  to,
  recipientName,
  loading = false,
  note,
  includeAttachment,
  onIncludeAttachmentChange,
}: EmailPreviewModalProps) {
  const [sending, setSending] = useState(false);
  const [editedSubject, setEditedSubject] = useState(subject);
  const [editedBody, setEditedBody] = useState(body);

  // Update state when props change
  useEffect(() => {
    setEditedSubject(subject);
    setEditedBody(body);
  }, [subject, body]);

  if (!isOpen) return null;

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend(editedSubject, editedBody);
      onClose();
    } catch (err) {
      console.error("Failed to send email:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Preview Email</h2>
            <p className="text-sm text-slate-500 mt-0.5">Review and edit before sending</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={sending}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Email Details */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* To */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
            <div className="text-sm text-slate-900 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              {recipientName && <span className="font-medium">{recipientName}</span>}
              {recipientName && <span className="text-slate-400"> &lt;</span>}
              <span className={recipientName ? "text-slate-600" : ""}>{to}</span>
              {recipientName && <span className="text-slate-400">&gt;</span>}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              value={editedSubject}
              onChange={(e) => setEditedSubject(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              disabled={sending}
            />
          </div>

          {/* Options */}
          {(typeof includeAttachment === "boolean" || note) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              {typeof includeAttachment === "boolean" && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={includeAttachment}
                    onChange={(e) => onIncludeAttachmentChange?.(e.target.checked)}
                    disabled={sending}
                  />
                  Attach PDF
                </label>
              )}
              {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}
            </div>
          )}

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
            <textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent font-sans text-sm"
              disabled={sending}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || loading}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            {sending ? "Sending..." : "Send Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}
