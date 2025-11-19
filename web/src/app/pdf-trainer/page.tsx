/**
 * PDF Trainer Page
 * 
 * Admin UI for creating annotation templates for supplier PDFs
 * Allows drawing labeled boxes on PDF pages to define layout patterns
 * These templates are used by the backend parser for reliable extraction
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Save,
  FileText,
  Trash2,
  Focus,
  Loader2,
} from 'lucide-react';
import { usePdfDocument } from '@/hooks/usePdfDocument';
import { PdfViewerWithAnnotations } from '@/components/pdf-trainer/PdfViewerWithAnnotations';
import type {
  AnnotationBox,
  PdfLayoutTemplate,
} from '@/types/pdfAnnotations';
import { LABEL_DISPLAY_NAMES, LABEL_BORDER_COLORS } from '@/types/pdfAnnotations';

const SUPPLIER_PROFILES = [
  'generic_supplier',
  'brio_v1',
  'siegenia_v1',
  'user_quote_v1',
  'historic_v1',
];

export default function PdfTrainerPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [supplierProfile, setSupplierProfile] = useState<string>('generic_supplier');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationBox[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // PDF document hook
  const {
    document,
    currentPage,
    totalPages,
    pageInfo,
    isLoading,
    error,
    setCurrentPage,
    nextPage,
    prevPage,
    renderToCanvas,
    getPageDimensions,
  } = usePdfDocument(selectedFile);

  // File selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setAnnotations([]); // Clear annotations when new file is loaded
      toast({
        title: 'PDF loaded',
        description: `${file.name} loaded successfully`,
      });
    } else {
      toast({
        title: 'Invalid file',
        description: 'Please select a PDF file',
        variant: 'destructive',
      });
    }
  };

  // Annotations for current page only
  const currentPageAnnotations = annotations.filter((a) => a.page === currentPage);

  // Update annotations
  const handleAnnotationsChange = useCallback(
    (newAnnotations: AnnotationBox[]) => {
      // Set page number for all annotations
      const annotationsWithPage = newAnnotations.map((a) => ({
        ...a,
        page: currentPage,
      }));

      // Merge with annotations from other pages
      const otherPageAnnotations = annotations.filter((a) => a.page !== currentPage);
      setAnnotations([...otherPageAnnotations, ...annotationsWithPage]);
    },
    [annotations, currentPage]
  );

  // Save template
  const handleSave = async () => {
    if (!document || annotations.length === 0) {
      toast({
        title: 'Nothing to save',
        description: 'Please create some annotations first',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      // Collect page sizes for all pages
      const pageSizes: Array<{ width: number; height: number }> = [];
      for (let i = 1; i <= totalPages; i++) {
        const dims = await getPageDimensions(i);
        if (dims) {
          pageSizes.push(dims);
        }
      }

      const template: PdfLayoutTemplate = {
        supplierProfile,
        pdfMeta: {
          pageCount: totalPages,
          pageSizes,
        },
        annotations,
      };

      const response = await fetch('/api/pdf-layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });

      if (!response.ok) {
        throw new Error('Failed to save template');
      }

      const result = await response.json();

      toast({
        title: 'Template saved',
        description: `Saved ${result.annotationCount} annotations for ${supplierProfile}`,
      });
    } catch (error: any) {
      console.error('[PdfTrainerPage] Save failed:', error);
      toast({
        title: 'Save failed',
        description: error?.message || 'Failed to save template',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete annotation
  const handleDeleteAnnotation = (boxId: string) => {
    setAnnotations(annotations.filter((a) => a.id !== boxId));
  };

  // Focus annotation (scroll to it - simplified for now)
  const handleFocusAnnotation = (boxId: string) => {
    const box = annotations.find((a) => a.id === boxId);
    if (box && box.page !== currentPage) {
      setCurrentPage(box.page);
    }
    // Could add more sophisticated focusing logic here
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">PDF Trainer</h1>
              <p className="text-sm text-muted-foreground">
                Create annotation templates for supplier quote parsing
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={!document || annotations.length === 0 || isSaving}
              size="lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Template
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex h-[calc(100vh-89px)]">
        {/* Left: PDF Viewer */}
        <div className="flex-1 overflow-auto p-6">
          {!selectedFile ? (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-12">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No PDF loaded</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Select a supplier profile and upload a PDF to begin
                </p>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-12">
                <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading PDF...</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-12">
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          ) : pageInfo ? (
            <PdfViewerWithAnnotations
              pageWidth={pageInfo.width}
              pageHeight={pageInfo.height}
              annotations={currentPageAnnotations}
              onRenderCanvas={renderToCanvas}
              onAnnotationsChange={handleAnnotationsChange}
            />
          ) : null}
        </div>

        {/* Right: Controls */}
        <div className="w-96 border-l bg-card overflow-auto">
          <div className="p-6 space-y-6">
            {/* Supplier profile */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Supplier Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="profile">Profile</Label>
                  <Select value={supplierProfile} onValueChange={setSupplierProfile}>
                    <SelectTrigger id="profile">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_PROFILES.map((profile) => (
                        <SelectItem key={profile} value={profile}>
                          {profile}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="pdf-upload">Upload PDF</Label>
                  <input
                    ref={fileInputRef}
                    id="pdf-upload"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {selectedFile ? selectedFile.name : 'Choose PDF'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Page navigation */}
            {document && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Page Navigation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={prevPage}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={nextPage}
                      disabled={currentPage >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Annotations list */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Annotations ({currentPageAnnotations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentPageAnnotations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No annotations on this page. Click and drag on the PDF to create boxes.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {currentPageAnnotations.map((box) => (
                      <div
                        key={box.id}
                        className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50"
                      >
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: LABEL_BORDER_COLORS[box.label] }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {LABEL_DISPLAY_NAMES[box.label]}
                          </div>
                          {box.rowId && (
                            <div className="text-xs text-muted-foreground">
                              Row: {box.rowId}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleFocusAnnotation(box.id)}
                          title="Focus"
                        >
                          <Focus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => handleDeleteAnnotation(box.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* All annotations summary */}
            {annotations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total annotations:</span>
                    <span className="font-medium">{annotations.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pages annotated:</span>
                    <span className="font-medium">
                      {new Set(annotations.map((a) => a.page)).size}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unique row IDs:</span>
                    <span className="font-medium">
                      {new Set(annotations.filter((a) => a.rowId).map((a) => a.rowId)).size}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>1. Select a supplier profile and upload a PDF</p>
                <p>2. Click and drag on the PDF to create annotation boxes</p>
                <p>3. Label each box (image, description, price, etc.)</p>
                <p>4. Group related boxes with the same row ID</p>
                <p>5. Save the template when done</p>
                <Separator className="my-2" />
                <p className="text-xs italic">
                  These templates will be used by the backend parser to reliably extract
                  line items and images from similar PDFs.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
