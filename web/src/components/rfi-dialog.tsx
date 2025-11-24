"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface RfiRecord {
  id: string;
  rowId: string | null;
  columnKey: string;
  title?: string | null;
  message: string;
  status: string;
  visibleToClient: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface RfiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfi?: RfiRecord | null;
  rowId: string | null;
  columnKey: string;
  columnName?: string;
  onSave: (rfi: Partial<RfiRecord>) => Promise<void>;
  mode: "create" | "edit" | "view";
}

export function RfiDialog({
  open,
  onOpenChange,
  rfi,
  rowId,
  columnKey,
  columnName,
  onSave,
  mode,
}: RfiDialogProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("open");
  const [visibleToClient, setVisibleToClient] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (rfi) {
      setTitle(rfi.title || "");
      setMessage(rfi.message || "");
      setStatus(rfi.status || "open");
      setVisibleToClient(rfi.visibleToClient || false);
    } else {
      setTitle("");
      setMessage("");
      setStatus("open");
      setVisibleToClient(false);
    }
  }, [rfi, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        id: rfi?.id,
        rowId,
        columnKey,
        title: title.trim() || null,
        message: message.trim(),
        status,
        visibleToClient,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save RFI:", error);
      alert("Failed to save RFI. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const isReadOnly = mode === "view";
  const isEditing = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "create" && "Add RFI"}
            {mode === "edit" && "Edit RFI"}
            {mode === "view" && "View RFI"}
            {rfi && (
              <Badge variant={status === "open" ? "destructive" : status === "answered" ? "default" : "secondary"}>
                {status}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Context information */}
            <div className="grid gap-2">
              <div className="text-sm text-muted-foreground">
                <strong>Context:</strong> {rowId ? `Cell in row ${rowId}` : "Entire column"}, Column: {columnName || columnKey}
              </div>
            </div>

            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">Title (Optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of the issue"
                disabled={isReadOnly}
                maxLength={100}
              />
            </div>

            {/* Message */}
            <div className="grid gap-2">
              <Label htmlFor="message">
                Message <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what information is needed or what the issue is..."
                disabled={isReadOnly}
                required
                rows={5}
                className="resize-none"
              />
            </div>

            {/* Status */}
            {(isEditing || mode === "view") && (
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus} disabled={isReadOnly}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="answered">Answered</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Visible to client toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="visible-client">Visible to Client</Label>
                <div className="text-sm text-muted-foreground">
                  Allow the client to see this RFI in their portal view
                </div>
              </div>
              <input
                type="checkbox"
                id="visible-client"
                checked={visibleToClient}
                onChange={(e) => setVisibleToClient(e.target.checked)}
                disabled={isReadOnly}
                className="h-4 w-4"
              />
            </div>

            {/* Timestamps (view/edit mode only) */}
            {rfi && (rfi.createdAt || rfi.updatedAt) && (
              <div className="text-xs text-muted-foreground space-y-1">
                {rfi.createdAt && (
                  <div>Created: {new Date(rfi.createdAt).toLocaleString()}</div>
                )}
                {rfi.updatedAt && (
                  <div>Updated: {new Date(rfi.updatedAt).toLocaleString()}</div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isReadOnly ? "Close" : "Cancel"}
            </Button>
            {!isReadOnly && (
              <Button type="submit" disabled={isSaving || !message.trim()}>
                {isSaving ? "Saving..." : mode === "create" ? "Create RFI" : "Update RFI"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
