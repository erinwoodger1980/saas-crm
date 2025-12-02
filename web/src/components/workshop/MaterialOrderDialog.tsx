"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface MaterialOrderDialogProps {
  taskTitle: string;
  materialType: string;
  onSave: (dates: {
    orderedDate: string;
    expectedDate: string;
    receivedDate: string | null;
  }) => void | Promise<void>;
  onCancel: () => void;
}

export default function MaterialOrderDialog({
  taskTitle,
  materialType,
  onSave,
  onCancel,
}: MaterialOrderDialogProps) {
  const today = new Date().toISOString().split('T')[0];
  const [orderedDate, setOrderedDate] = useState(today);
  const [expectedDate, setExpectedDate] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!orderedDate) {
      alert("Please enter when the material was ordered");
      return;
    }
    
    setLoading(true);
    try {
      await onSave({
        orderedDate,
        expectedDate: expectedDate || "",
        receivedDate: receivedDate || null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <Card
        className="p-6 max-w-md w-full m-4 bg-white shadow-2xl border"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-2">Complete Material Order</h2>
        <p className="text-sm text-gray-600 mb-4">
          Task: <strong>{taskTitle}</strong>
        </p>
        
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-900">
              📦 {materialType}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Fill in the material ordering details
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Ordered Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={orderedDate}
              onChange={(e) => setOrderedDate(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500 mt-1">When was the order placed?</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Expected Delivery Date
            </label>
            <Input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">When is the material expected to arrive?</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Received Date (if already arrived)
            </label>
            <Input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">Leave blank if not yet received</p>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !orderedDate}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {loading ? "Saving..." : "Complete Task"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
