"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ProcessCompletionDialogProps {
  processName: string;
  onComplete: (comments: string) => void | Promise<void>;
  onSkip: () => void;
  isLastProcess?: boolean;
}

export default function ProcessCompletionDialog({
  processName,
  onComplete,
  onSkip,
  isLastProcess = false,
}: ProcessCompletionDialogProps) {
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      await onComplete(comments);
    } catch (error) {
      console.error("Error completing process:", error);
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
        <h2 className="text-xl font-semibold mb-4">Process Complete?</h2>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-700">
            Is <strong>{processName}</strong> complete?
          </div>

          {isLastProcess && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">
                ⭐ This is the final {isLastProcess ? "process" : ""} - marking it complete will update the project status.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">
              Completion Notes (optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add any notes about this process completion..."
              className="w-full border rounded-md p-2 min-h-[80px] text-sm"
              disabled={loading}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleComplete}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {loading ? "Marking Complete..." : "Yes, Mark Complete"}
            </Button>
            <Button
              variant="outline"
              onClick={onSkip}
              disabled={loading}
              className="flex-1"
            >
              No, Just Stop Timer
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
