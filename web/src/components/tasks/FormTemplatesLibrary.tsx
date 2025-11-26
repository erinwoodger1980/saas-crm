// web/src/components/tasks/FormTemplatesLibrary.tsx
"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  Search,
  Filter,
  Plus,
  Copy,
  Eye,
  Star,
} from "lucide-react";

type FormTemplate = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  requiresSignature: boolean;
  isPublic: boolean;
  usageCount?: number;
  rating?: number;
  formSchema: {
    fields: any[];
  };
  createdAt: string;
  createdBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
};

const TEMPLATE_CATEGORIES = [
  "Safety & Compliance",
  "Quality Control",
  "Maintenance",
  "HR & Onboarding",
  "Customer Service",
  "Finance & Procurement",
  "Training",
  "Other",
];

interface FormTemplatesLibraryProps {
  onTemplateSelected?: (template: FormTemplate) => void;
}

export function FormTemplatesLibrary({ onTemplateSelected }: FormTemplatesLibraryProps) {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";

  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showPublicOnly, setShowPublicOnly] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<FormTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [tenantId]);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchQuery, selectedCategory, showPublicOnly]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/tasks/form-templates", {
        headers: { "x-tenant-id": tenantId },
      });
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = [...templates];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.category?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }

    // Public only filter
    if (showPublicOnly) {
      filtered = filtered.filter((t) => t.isPublic);
    }

    // Sort by usage count and rating
    filtered.sort((a, b) => {
      const aScore = (a.usageCount || 0) * 10 + (a.rating || 0);
      const bScore = (b.usageCount || 0) * 10 + (b.rating || 0);
      return bScore - aScore;
    });

    setFilteredTemplates(filtered);
  };

  const handlePreview = (template: FormTemplate) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const handleUseTemplate = (template: FormTemplate) => {
    onTemplateSelected?.(template);
    setShowPreview(false);
  };

  const handleCloneTemplate = async (template: FormTemplate) => {
    try {
      const response = await apiFetch(`/tasks/form-templates/${template.id}/clone`, {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "Content-Type": "application/json",
        },
      });
      const cloned = await response.json();
      
      // Success notification
      const toast = document.createElement("div");
      toast.textContent = `✓ Template "${template.name}" cloned successfully`;
      toast.className =
        "fixed bottom-6 right-6 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
      
      loadTemplates();
      onTemplateSelected?.(cloned);
    } catch (error) {
      console.error("Failed to clone template:", error);
      alert("Failed to clone template");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Form Templates Library</h2>
          <p className="text-sm text-muted-foreground">
            Browse and use pre-built form templates
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {TEMPLATE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="publicOnly"
              checked={showPublicOnly}
              onChange={(e) => setShowPublicOnly(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="publicOnly" className="text-sm font-medium">
              Show public templates only
            </label>
          </div>
        </div>
      </Card>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No templates found</h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search or filters
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold line-clamp-1">{template.name}</h3>
                    {template.category && (
                      <Badge variant="secondary" className="mt-1">
                        {template.category}
                      </Badge>
                    )}
                  </div>
                  {template.isPublic && (
                    <Badge variant="outline" className="ml-2">
                      Public
                    </Badge>
                  )}
                </div>

                {template.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{template.formSchema.fields.length} fields</span>
                  {template.requiresSignature && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Signature
                    </span>
                  )}
                  {template.usageCount !== undefined && (
                    <span>{template.usageCount} uses</span>
                  )}
                  {template.rating && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {template.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreview(template)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleUseTemplate(template)}
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Use
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCloneTemplate(template)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      {previewTemplate && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{previewTemplate.name}</DialogTitle>
              <DialogDescription>{previewTemplate.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {previewTemplate.category && (
                  <Badge>{previewTemplate.category}</Badge>
                )}
                {previewTemplate.requiresSignature && (
                  <Badge variant="secondary">Requires Signature</Badge>
                )}
                <Badge variant="outline">
                  {previewTemplate.formSchema.fields.length} Fields
                </Badge>
              </div>
              
              <div className="space-y-3 border-t pt-4">
                <h4 className="font-semibold">Form Fields</h4>
                {previewTemplate.formSchema.fields.map((field: any, idx: number) => (
                  <div
                    key={field.id || idx}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                  >
                    <Badge variant="outline" className="text-xs">
                      {field.type}
                    </Badge>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{field.label}</div>
                      {field.placeholder && (
                        <div className="text-xs text-muted-foreground">
                          {field.placeholder}
                        </div>
                      )}
                    </div>
                    {field.required && (
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Close
              </Button>
              <Button onClick={() => handleUseTemplate(previewTemplate)}>
                Use This Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
