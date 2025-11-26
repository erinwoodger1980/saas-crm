// web/src/components/tasks/QuickCommunicationLog.tsx
"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { Phone, Mail, Video, MessageSquare, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";

type CommunicationType = "EMAIL" | "PHONE" | "MEETING" | "SMS" | "OTHER";
type CommunicationDirection = "INBOUND" | "OUTBOUND";

const COMM_TYPES = [
  { type: "PHONE" as CommunicationType, label: "Phone Call", icon: Phone, color: "bg-green-100 text-green-700" },
  { type: "EMAIL" as CommunicationType, label: "Email", icon: Mail, color: "bg-blue-100 text-blue-700" },
  { type: "MEETING" as CommunicationType, label: "Meeting", icon: Video, color: "bg-purple-100 text-purple-700" },
  { type: "SMS" as CommunicationType, label: "SMS", icon: MessageSquare, color: "bg-orange-100 text-orange-700" },
];

interface QuickCommunicationLogProps {
  relatedType: string;
  relatedId: string;
  onSaved?: () => void;
}

export function QuickCommunicationLog({ 
  relatedType, 
  relatedId, 
  onSaved 
}: QuickCommunicationLogProps) {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";

  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<CommunicationType | null>(null);
  const [direction, setDirection] = useState<CommunicationDirection>("OUTBOUND");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedType || !notes.trim()) return;

    setSaving(true);
    try {
      await apiFetch("/tasks/communication", {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "Content-Type": "application/json",
        },
        json: {
          communicationType: selectedType,
          communicationDirection: direction,
          communicationNotes: notes,
          relatedType,
          relatedId,
        },
      });

      // Reset form
      setSelectedType(null);
      setNotes("");
      setDirection("OUTBOUND");
      setOpen(false);

      // Notify parent
      onSaved?.();

      // Show success toast
      const toast = document.createElement("div");
      toast.textContent = "✓ Communication logged";
      toast.className = "fixed bottom-6 right-6 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    } catch (error) {
      console.error("Failed to log communication:", error);
      
      const toast = document.createElement("div");
      toast.textContent = "Failed to save communication";
      toast.className = "fixed bottom-6 right-6 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-50";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Phone className="h-4 w-4 mr-2" />
        Log Communication
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Log Communication</DialogTitle>
            <DialogDescription>
              Quickly record a phone call, meeting, or other interaction
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Communication Type */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Type of Communication
              </label>
              <div className="grid grid-cols-2 gap-3">
                {COMM_TYPES.map(({ type, label, icon: Icon, color }) => (
                  <Card
                    key={type}
                    className={`p-4 cursor-pointer transition-all ${
                      selectedType === type
                        ? "ring-2 ring-blue-500 shadow-md"
                        : "hover:shadow-md"
                    }`}
                    onClick={() => setSelectedType(type)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="font-medium">{label}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Direction */}
            {selectedType && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-3 block">
                  Direction
                </label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={direction === "OUTBOUND" ? "default" : "outline"}
                    onClick={() => setDirection("OUTBOUND")}
                    className="flex-1"
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Outbound (I contacted them)
                  </Button>
                  <Button
                    type="button"
                    variant={direction === "INBOUND" ? "default" : "outline"}
                    onClick={() => setDirection("INBOUND")}
                    className="flex-1"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Inbound (They contacted me)
                  </Button>
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedType && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Notes
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What was discussed? Any outcomes or next steps?"
                  rows={6}
                  className="resize-none"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!selectedType || !notes.trim() || saving}
            >
              {saving ? "Saving..." : "Save Communication"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
