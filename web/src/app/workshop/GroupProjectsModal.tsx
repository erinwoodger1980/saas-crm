import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { X, ChevronDown } from "lucide-react";

interface Opportunity {
  id: string;
  title: string;
  valueGBP?: number | null;
  stage: string;
  client?: { name: string } | null;
}

interface GroupProjectsModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  opportunities?: Opportunity[];
  onGroupCreated?: () => void | Promise<void>;
}

export function GroupProjectsModal({
  open,
  onOpenChange,
  opportunities = [],
  onGroupCreated,
}: GroupProjectsModalProps) {
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [budgetHours, setBudgetHours] = useState("");
  const [scheduledStartDate, setScheduledStartDate] = useState("");
  const [scheduledEndDate, setScheduledEndDate] = useState("");
  const [selectedOppIds, setSelectedOppIds] = useState<Set<string>>(new Set());
  const [expandedOpp, setExpandedOpp] = useState<string | null>(null);
  const { toast } = useToast();

  // Filter to only WON opportunities
  const wonOpportunities = opportunities.filter((o) => o.stage === "WON");

  function toggleOppSelection(oppId: string) {
    const newSelected = new Set(selectedOppIds);
    if (newSelected.has(oppId)) {
      newSelected.delete(oppId);
    } else {
      newSelected.add(oppId);
    }
    setSelectedOppIds(newSelected);
  }

  function selectAll() {
    if (selectedOppIds.size === wonOpportunities.length) {
      setSelectedOppIds(new Set());
    } else {
      setSelectedOppIds(new Set(wonOpportunities.map((o) => o.id)));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!groupName.trim()) {
      toast({
        title: "Error",
        description: "Group name is required",
        variant: "destructive",
      });
      return;
    }

    if (selectedOppIds.size === 0) {
      toast({
        title: "Error",
        description: "Select at least one project",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: groupName.trim(),
        description: groupDescription || undefined,
        opportunityIds: Array.from(selectedOppIds),
        budgetHours: budgetHours ? parseFloat(budgetHours) : undefined,
        scheduledStartDate: scheduledStartDate || undefined,
        scheduledEndDate: scheduledEndDate || undefined,
        status: "PLANNED",
      };

      const response = await apiFetch("/opportunity-groups", {
        method: "POST",
        json: data,
      });

      if (response?.ok) {
        toast({
          title: "Success",
          description: `Group "${groupName}" created with ${selectedOppIds.size} project${selectedOppIds.size !== 1 ? "s" : ""}`,
        });

        // Reset form
        setGroupName("");
        setGroupDescription("");
        setBudgetHours("");
        setScheduledStartDate("");
        setScheduledEndDate("");
        setSelectedOppIds(new Set());
        onOpenChange(false);

        if (onGroupCreated) await onGroupCreated();
      }
    } catch (err: any) {
      console.error("Error creating group:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to create group",
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
          <DialogTitle>Create Project Group</DialogTitle>
          <DialogDescription>
            Batch multiple projects together for manufacturing and assign time
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group details */}
          <div>
            <label className="block text-sm font-medium mb-1">Group Name *</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., January Production Batch"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              placeholder="Group notes..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              rows={2}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Budget Hours</label>
              <input
                type="number"
                value={budgetHours}
                onChange={(e) => setBudgetHours(e.target.value)}
                placeholder="0"
                step="0.5"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={scheduledStartDate}
                onChange={(e) => setScheduledStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={scheduledEndDate}
              onChange={(e) => setScheduledEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              disabled={loading}
            />
          </div>

          {/* Project selection */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Select Projects ({selectedOppIds.size}/{wonOpportunities.length})
              </label>
              {wonOpportunities.length > 0 && (
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={loading}
                  className="text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50"
                >
                  {selectedOppIds.size === wonOpportunities.length
                    ? "Deselect all"
                    : "Select all"}
                </button>
              )}
            </div>

            {wonOpportunities.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
                No WON projects available. Create some projects first.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {wonOpportunities.map((opp) => (
                  <div key={opp.id} className="rounded border border-slate-100 hover:bg-amber-50 transition">
                    <button
                      type="button"
                      onClick={() => {
                        if (expandedOpp === opp.id) {
                          setExpandedOpp(null);
                        } else {
                          setExpandedOpp(opp.id);
                        }
                      }}
                      disabled={loading}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-left disabled:opacity-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedOppIds.has(opp.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleOppSelection(opp.id);
                        }}
                        disabled={loading}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{opp.title}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {opp.client?.name || "No client"}
                          {opp.valueGBP && ` • £${opp.valueGBP.toLocaleString()}`}
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition ${
                          expandedOpp === opp.id ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {expandedOpp === opp.id && (
                      <div className="border-t border-slate-100 px-2 py-2 bg-slate-50 text-xs text-slate-600">
                        <div>
                          {opp.title} {opp.valueGBP && `(£${opp.valueGBP})`}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
              disabled={loading || selectedOppIds.size === 0}
              className="bg-gradient-to-r from-amber-400 via-rose-400 to-pink-400 text-white"
            >
              {loading ? "Creating..." : `Create Group (${selectedOppIds.size} projects)`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
