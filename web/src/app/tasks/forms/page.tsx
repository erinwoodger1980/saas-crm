// web/src/app/tasks/forms/page.tsx
"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { FormBuilder } from "@/components/tasks/FormBuilder";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeskSurface } from "@/components/DeskSurface";
import { Plus, FileText, Edit, Trash2, Copy } from "lucide-react";

export const dynamic = "force-dynamic";

type FormTemplate = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  requiresSignature: boolean;
  formSchema: any;
  isActive: boolean;
  createdAt: string;
};

export default function FormsPage() {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";

  const [view, setView] = useState<"list" | "builder">("list");
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);

  const loadTemplates = async () => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const data = await apiFetch<FormTemplate[]>("/tasks/forms", {
        headers: { "x-tenant-id": tenantId },
      });
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load form templates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === "list") {
      loadTemplates();
    }
  }, [view]); // eslint-disable-line

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setView("builder");
  };

  const handleEdit = (template: FormTemplate) => {
    setEditingTemplate(template);
    setView("builder");
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this form template?")) return;

    try {
      await apiFetch(`/tasks/forms/${templateId}`, {
        method: "DELETE",
        headers: { "x-tenant-id": tenantId },
      });
      loadTemplates();

      const toast = document.createElement("div");
      toast.textContent = "✓ Form template deleted";
      toast.className =
        "fixed bottom-6 right-6 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    } catch (error) {
      console.error("Failed to delete form template:", error);
      alert("Failed to delete form template");
    }
  };

  const handleSaved = () => {
    setView("list");
    setEditingTemplate(null);
  };

  if (view === "builder") {
    return (
      <DeskSurface variant="violet" innerClassName="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {editingTemplate ? "Edit Form Template" : "Create Form Template"}
            </h1>
            <p className="text-gray-600 mt-1">
              Build custom forms with drag-and-drop fields
            </p>
          </div>
          <Button variant="outline" onClick={() => setView("list")}>
            Back to List
          </Button>
        </div>

        <FormBuilder
          existingTemplate={editingTemplate || undefined}
          onSaved={handleSaved}
          onCancel={() => setView("list")}
        />
      </DeskSurface>
    );
  }

  return (
    <DeskSurface variant="violet" innerClassName="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Form Templates</h1>
          <p className="text-gray-600 mt-1">
            Create and manage reusable digital forms for your team
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Create Form
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading templates...</div>
      ) : templates.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-gray-400 mb-4">
            <FileText className="h-16 w-16 mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No form templates yet
          </h3>
          <p className="text-gray-500 mb-6">
            Create your first form template to streamline data collection
          </p>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Form
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    {template.category && (
                      <Badge variant="secondary" className="mt-1">
                        {template.category}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {template.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {template.description}
                </p>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                <span>
                  {template.formSchema?.fields?.length || 0} field
                  {template.formSchema?.fields?.length !== 1 ? "s" : ""}
                </span>
                {template.requiresSignature && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Edit className="h-3 w-3" />
                      Signature required
                    </span>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEdit(template)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(template.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </DeskSurface>
  );
}
