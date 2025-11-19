"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Trash2, FileText, Calendar, Eye } from "lucide-react";

interface PdfTemplate {
  id: string;
  name: string;
  description: string | null;
  supplierProfileId: string | null;
  fileHash: string | null;
  pageCount: number | null;
  createdAt: string;
  updatedAt: string;
}

interface TemplateWithDetails extends PdfTemplate {
  annotations?: any[];
}

export default function PdfTemplatesSection() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewTemplate, setViewTemplate] = useState<TemplateWithDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Load templates
  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/pdf-templates");
      if (!response.ok) throw new Error("Failed to load templates");
      
      const data = await response.json();
      setTemplates(data.items || []);
    } catch (error: any) {
      console.error("[PdfTemplatesSection] Load error:", error);
      toast({
        title: "Failed to load templates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Load template details
  const loadTemplateDetails = async (id: string) => {
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`/api/pdf-templates/${id}`);
      if (!response.ok) throw new Error("Failed to load template details");
      
      const data = await response.json();
      setViewTemplate(data.item);
    } catch (error: any) {
      console.error("[PdfTemplatesSection] Load details error:", error);
      toast({
        title: "Failed to load template",
        description: error.message,
        variant: "destructive",
      });
      setViewTemplate(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Delete template
  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/pdf-templates/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete template");

      toast({
        title: "Template deleted",
        description: "PDF template has been removed",
      });

      setTemplates(templates.filter((t) => t.id !== deleteId));
      setDeleteId(null);
    } catch (error: any) {
      console.error("[PdfTemplatesSection] Delete error:", error);
      toast({
        title: "Failed to delete template",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              View all annotated PDF templates used for parsing supplier quotes.
              Templates are app-wide and available to all tenants.
            </p>
          </div>
        </div>

        {templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground text-center">
                No PDF templates yet.
                <br />
                Use the PDF Trainer to create annotation templates.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Profile ID</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      {template.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {template.description || "-"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {template.supplierProfileId || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {template.pageCount || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(template.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadTemplateDetails(template.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(template.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete PDF Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View details dialog */}
      <Dialog open={!!viewTemplate} onOpenChange={() => setViewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Details</DialogTitle>
          </DialogHeader>
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : viewTemplate ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">{viewTemplate.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Profile ID</Label>
                  <p className="font-mono text-sm">
                    {viewTemplate.supplierProfileId || "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Pages</Label>
                  <p>{viewTemplate.pageCount || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">File Hash</Label>
                  <p className="font-mono text-xs truncate">
                    {viewTemplate.fileHash || "-"}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{viewTemplate.description || "-"}</p>
                </div>
              </div>

              {viewTemplate.annotations && viewTemplate.annotations.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">
                    Annotations ({viewTemplate.annotations.length})
                  </Label>
                  <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(viewTemplate.annotations, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="flex gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Created: {formatDate(viewTemplate.createdAt)}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Updated: {formatDate(viewTemplate.updatedAt)}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setViewTemplate(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
