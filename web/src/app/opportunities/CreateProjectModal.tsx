import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients?: Array<{ id: string; name: string; email?: string | null }>;
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

  const sortedClients = useMemo(() => {
    const list = Array.isArray(clients) ? [...clients] : [];
    list.sort((a, b) => {
      const an = String(a?.name || "").trim();
      const bn = String(b?.name || "").trim();
      return an.localeCompare(bn, undefined, { sensitivity: "base" });
    });
    return list;
  }, [clients]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const projectTitle = title.trim();
      const selectedClient = clientId ? sortedClients.find((c) => c.id === clientId) : null;
      const leadContactName = String(selectedClient?.name || projectTitle).trim();
      const leadEmailRaw = selectedClient?.email != null ? String(selectedClient.email).trim() : "";
      const leadEmail = leadEmailRaw || undefined;
      const allowNoEmail = !leadEmail;

      // 1) Create a WON Lead (Orders page is lead-driven)
      const createdLead = await apiFetch<any>("/leads", {
        method: "POST",
        json: {
          contactName: leadContactName,
          email: leadEmail,
          noEmail: allowNoEmail,
          status: "WON",
          description: projectTitle,
        },
      });

      const leadId = String(createdLead?.id || "");
      if (!leadId) throw new Error("Lead creation failed");

      // 2) If a client was selected, link the lead to that client explicitly
      if (clientId) {
        await apiFetch(`/leads/${encodeURIComponent(leadId)}`, {
          method: "PATCH",
          json: { clientId },
        });
      }

      // 3) Ensure an opportunity exists for the lead, then update key project fields
      const ensured = await apiFetch<any>(`/opportunities/ensure-for-lead/${encodeURIComponent(leadId)}`, {
        method: "POST",
        json: {},
      });
      const oppId = String(ensured?.opportunity?.id || ensured?.id || "");
      if (oppId) {
        await apiFetch(`/opportunities/${encodeURIComponent(oppId)}`, {
          method: "PATCH",
          json: {
            title: projectTitle,
            description: description || undefined,
            clientId: clientId || undefined,
            stage: "WON",
            valueGBP: valueGBP ? parseFloat(valueGBP) : null,
            startDate: startDate || null,
            deliveryDate: deliveryDate || null,
          },
        });
      }

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
              {sortedClients.map((c) => (
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
