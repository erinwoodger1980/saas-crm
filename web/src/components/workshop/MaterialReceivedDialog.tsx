"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface MaterialReceivedDialogProps {
  taskTitle: string;
  linkedMaterialType?: string;
  onConfirmReceived: (receivedDate: string, notes: string) => void | Promise<void>;
  onSkip: () => void;
}

export default function MaterialReceivedDialog({
  taskTitle,
  linkedMaterialType,
  onConfirmReceived,
  onSkip,
}: MaterialReceivedDialogProps) {
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirmReceived(receivedDate, notes);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onSkip}
    >
      <Card
        className="p-6 max-w-md w-full m-4 bg-white shadow-2xl border"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">Material Received?</h2>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-700">
            You completed <strong>{taskTitle}</strong>
            {linkedMaterialType && (
              <span> which is linked to <strong>{linkedMaterialType}</strong> order.</span>
            )}
          </div>

          {linkedMaterialType && (
            <>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Has the {linkedMaterialType} been received?
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Received Date</label>
                <Input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about the delivery..."
                  className="w-full border rounded-md p-2 min-h-[60px] text-sm"
                  disabled={loading}
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            {linkedMaterialType ? (
              <>
                <Button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {loading ? "Updating..." : "Yes, Mark Received"}
                </Button>
                <Button
                  variant="outline"
                  onClick={onSkip}
                  disabled={loading}
                  className="flex-1"
                >
                  No, Not Yet
                </Button>
              </>
            ) : (
              <Button
                onClick={onSkip}
                className="flex-1"
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
