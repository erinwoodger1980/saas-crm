import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients?: Array<{ id: string; name: string }>;
  onCreated?: () => void | Promise<void>;
}

export function CreateProjectModal({
  open,
  onOpenChange,
  clients = [],
  onCreated,
}: CreateProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [valueGBP, setValueGBP] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const data = {
        title: title.trim(),
        clientId: clientId || undefined,
        valueGBP: valueGBP ? parseFloat(valueGBP) : undefined,
        startDate: startDate || undefined,
        deliveryDate: deliveryDate || undefined,
        description: description || undefined,
        stage: "WON",
      };

      const response = await apiFetch("/opportunities", {
        method: "POST",
        json: data,
      });

      if (response?.ok) {
        toast({
          title: "Success",
          description: "Project created successfully",
        });

        // Reset form
        setTitle("");
        setClientId("");
        setValueGBP("");
        setStartDate("");
        setDeliveryDate("");
        setDescription("");
        onOpenChange(false);
        
        if (onCreated) await onCreated();
      }
    } catch (err: any) {
      console.error("Error creating project:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to create project",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Create a won opportunity directly without requiring a lead first
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Project Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Kitchen Windows & Doors"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              disabled={loading}
            >
              <option value="">Select a client (optional)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Value (£)</label>
              <input
                type="number"
                value={valueGBP}
                onChange={(e) => setValueGBP(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Delivery Date</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project details..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
              disabled={loading}
              className="bg-gradient-to-r from-amber-400 via-rose-400 to-pink-400 text-white"
            >
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
