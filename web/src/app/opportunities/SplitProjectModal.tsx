import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { X } from "lucide-react";

interface SplitProjectModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  opportunityId: string;
  opportunityTitle: string;
  onSplit?: () => void | Promise<void>;
}

interface Split {
  id: string;
  title: string;
  description: string;
  valueGBP: string;
}

const COMMON_SPLITS = [
  { label: "Windows", icon: "🪟" },
  { label: "Doors", icon: "🚪" },
  { label: "Hardware", icon: "⚙️" },
  { label: "Installation", icon: "🔨" },
  { label: "Finishing", icon: "🎨" },
];

export function SplitProjectModal({
  open,
  onOpenChange,
  opportunityId,
  opportunityTitle,
  onSplit,
}: SplitProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [splits, setSplits] = useState<Split[]>([
    { id: "1", title: "Windows", description: "", valueGBP: "" },
    { id: "2", title: "Doors", description: "", valueGBP: "" },
  ]);
  const { toast } = useToast();

  function addSplit() {
    const newSplit: Split = {
      id: String(Date.now()),
      title: "",
      description: "",
      valueGBP: "",
    };
    setSplits([...splits, newSplit]);
  }

  function removeSplit(id: string) {
    setSplits(splits.filter((s) => s.id !== id));
  }

  function updateSplit(id: string, field: keyof Split, value: string) {
    setSplits(
      splits.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      )
    );
  }

  function addTemplate(label: string) {
    if (!splits.find((s) => s.title.toLowerCase() === label.toLowerCase())) {
      setSplits([
        ...splits,
        {
          id: String(Date.now()),
          title: label,
          description: "",
          valueGBP: "",
        },
      ]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (splits.length === 0) {
      toast({
        title: "Error",
        description: "Add at least one split",
        variant: "destructive",
      });
      return;
    }

    if (splits.some((s) => !s.title.trim())) {
      toast({
        title: "Error",
        description: "All splits must have a title",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const data = {
        splits: splits.map((s) => ({
          title: s.title,
          description: s.description || undefined,
          valueGBP: s.valueGBP ? parseFloat(s.valueGBP) : undefined,
        })),
      };

      const response = await apiFetch(`/opportunities/${opportunityId}/split`, {
        method: "POST",
        json: data,
      });

      if (response?.ok) {
        toast({
          title: "Success",
          description: `Project split into ${splits.length} sub-projects`,
        });

        setSplits([
          { id: "1", title: "Windows", description: "", valueGBP: "" },
          { id: "2", title: "Doors", description: "", valueGBP: "" },
        ]);
        onOpenChange(false);

        if (onSplit) await onSplit();
      }
    } catch (err: any) {
      console.error("Error splitting project:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to split project",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Split Project</DialogTitle>
          <DialogDescription>
            Split "{opportunityTitle}" into multiple sub-projects (windows, doors, etc.)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick templates */}
          <div>
            <label className="block text-sm font-medium mb-2">Quick Add</label>
            <div className="flex flex-wrap gap-2">
              {COMMON_SPLITS.map((split) => (
                <button
                  key={split.label}
                  type="button"
                  onClick={() => addTemplate(split.label)}
                  disabled={
                    loading || splits.some((s) => s.title === split.label)
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <span>{split.icon}</span>
                  {split.label}
                </button>
              ))}
            </div>
          </div>

          {/* Split items */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Sub-Projects</label>
              <button
                type="button"
                onClick={addSplit}
                disabled={loading}
                className="text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50"
              >
                + Add
              </button>
            </div>

            {splits.map((split, idx) => (
              <div key={split.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={split.title}
                      onChange={(e) =>
                        updateSplit(split.id, "title", e.target.value)
                      }
                      placeholder={`Sub-project ${idx + 1} title`}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      disabled={loading}
                    />
                  </div>
                  {splits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSplit(split.id)}
                      disabled={loading}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={split.description}
                  onChange={(e) =>
                    updateSplit(split.id, "description", e.target.value)
                  }
                  placeholder="Description (optional)"
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  disabled={loading}
                />

                <input
                  type="number"
                  value={split.valueGBP}
                  onChange={(e) =>
                    updateSplit(split.id, "valueGBP", e.target.value)
                  }
                  placeholder="Value (£) - optional"
                  step="0.01"
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                  disabled={loading}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || splits.length === 0}
              className="bg-gradient-to-r from-amber-400 via-rose-400 to-pink-400 text-white"
            >
              {loading
                ? "Splitting..."
                : `Split into ${splits.length} project${splits.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
