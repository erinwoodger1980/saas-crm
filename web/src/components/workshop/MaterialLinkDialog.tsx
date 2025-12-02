"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MaterialLinkDialogProps {
  taskId: string;
  taskTitle: string;
  projects: Array<{ id: string; name: string }>;
  onLink: (materialType: string, opportunityId: string) => void | Promise<void>;
  onCancel: () => void;
}

export default function MaterialLinkDialog({
  taskId,
  taskTitle,
  projects,
  onLink,
  onCancel,
}: MaterialLinkDialogProps) {
  const [materialType, setMaterialType] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLink = async () => {
    if (!materialType || !opportunityId) return;
    
    setLoading(true);
    try {
      await onLink(materialType, opportunityId);
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
        <h2 className="text-xl font-semibold mb-4">Link Task to Material Order</h2>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-700 mb-4">
            Link <strong>{taskTitle}</strong> to a material order
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Material Type</label>
            <Select value={materialType} onValueChange={setMaterialType}>
              <SelectTrigger>
                <SelectValue placeholder="Select material type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="timber">Timber</SelectItem>
                <SelectItem value="glass">Glass</SelectItem>
                <SelectItem value="ironmongery">Ironmongery</SelectItem>
                <SelectItem value="paint">Paint</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Project</label>
            <Select value={opportunityId} onValueChange={setOpportunityId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleLink}
              disabled={!materialType || !opportunityId || loading}
              className="flex-1"
            >
              {loading ? "Linking..." : "Link Material"}
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
