/**
 * PDF Trainer Client Component
 * 
 * Client-only component that uses browser-specific APIs (DOMMatrix, PDF.js)
 * Separated from page.tsx to avoid SSR issues during build
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
import { apiFetch } from '@/lib/api';
import { fetchQuoteSourceProfiles } from '@/lib/api/quotes';

interface SourceProfile {
  id: string;
  displayName: string;
  type: 'supplier' | 'software';
  source: 'static' | 'tenant' | 'link' | 'global';
  tenantName?: string | null;
}

export function PdfTrainerClient() {
  const searchParams = useSearchParams();
  const queryProfileId = searchParams.get('profileId');
  const queryQuoteId = searchParams.get('quoteId');
  const queryFileId = searchParams.get('fileId');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const remoteFileLoadedRef = useRef(false);

  // State
  const [supplierProfile, setSupplierProfile] = useState<string>(queryProfileId || 'generic_supplier');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationBox[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [profiles, setProfiles] = useState<SourceProfile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [isLoadingRemoteFile, setIsLoadingRemoteFile] = useState(false);
  const [remoteFileError, setRemoteFileError] = useState<string | null>(null);

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

  // Load profiles on mount
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const raw = await fetchQuoteSourceProfiles();
        console.log('[PdfTrainerClient] Raw profiles response:', raw);
        
        // Map to component's expected shape
        let mapped: SourceProfile[] = (raw || []).map((p: any) => ({
          id: p.id,
          displayName: p.name ?? p.displayName ?? humanizeProfileId(p.id),
          type: p.type,
          source: (p.source ?? (p.type === 'software' ? 'static' : 'tenant')) as SourceProfile['source'],
          tenantName: p.tenantName ?? null,
        }));

        if (queryProfileId && !mapped.some((p) => p.id === queryProfileId)) {
          mapped = [
            {
              id: queryProfileId,
              displayName: humanizeProfileId(queryProfileId),
              type: 'supplier',
              source: 'link',
            },
            ...mapped,
          ];
        }
        
        console.log('[PdfTrainerClient] Mapped profiles:', mapped);
        setProfiles(mapped);

        if (queryProfileId) {
          setSupplierProfile(queryProfileId);
        } else if (mapped.length === 0) {
          console.warn('[PdfTrainerClient] No profiles returned from API');
        }
      } catch (error: any) {
        console.error('[PdfTrainerClient] Failed to load profiles:', error);
        toast({
          title: 'Failed to load profiles',
          description: error?.message || 'Unable to fetch source profiles',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingProfiles(false);
      }
    };

    loadProfiles();
  }, [queryProfileId, toast]);

  useEffect(() => {
    if (!queryQuoteId || !queryFileId) return;
    if (remoteFileLoadedRef.current) return;
    let aborted = false;
    remoteFileLoadedRef.current = true;
    setIsLoadingRemoteFile(true);
    setRemoteFileError(null);

    (async () => {
      try {
        const signed = await apiFetch<{ ok?: boolean; url?: string }>(
          `/quotes/${encodeURIComponent(queryQuoteId)}/files/${encodeURIComponent(queryFileId)}/signed`
        );
        if (aborted) return;
        const url = signed?.url;
        if (!url) throw new Error('Missing signed download URL');
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Download failed (${response.status})`);
        const blob = await response.blob();
        if (aborted) return;
        const filename = extractFilename(response.headers.get('Content-Disposition')) || `supplier-file-${queryFileId}.pdf`;
        const inferredType = blob.type || 'application/pdf';
        const file = new File([blob], filename, { type: inferredType });
        setSelectedFile(file);
        setAnnotations([]);
        toast({ title: 'PDF loaded', description: filename });
      } catch (error: any) {
        if (aborted) return;
        console.error('[PdfTrainerClient] Remote file load failed:', error);
        const message = error?.message || 'Unable to load PDF from quote context';
        setRemoteFileError(message);
        toast({ title: 'Failed to load PDF', description: message, variant: 'destructive' });
      } finally {
        if (!aborted) setIsLoadingRemoteFile(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [queryQuoteId, queryFileId, toast]);

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
      // Generate template name from profile
      const profileName = profiles.find(p => p.id === supplierProfile)?.displayName || supplierProfile;
      const templateName = `${profileName} - ${selectedFile?.name || 'template'}`;

      const result = await apiFetch('/pdf-templates', {
        method: 'POST',
        json: {
          name: templateName,
          description: `Annotated template for ${profileName}`,
          supplierProfileId: supplierProfile,
          pageCount: totalPages,
          annotations,
        },
      });

      toast({
        title: 'Template saved',
  description: `Saved ${annotations.length} annotations for ${profileName}`,
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => window.location.href = '/settings?tab=pdf-templates'}
                size="lg"
              >
                <FileText className="mr-2 h-4 w-4" />
                View Templates
              </Button>
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
            {/* Source profile */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quote Source Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="profile">Profile</Label>
                  <Select value={supplierProfile} onValueChange={setSupplierProfile} disabled={isLoadingProfiles}>
                    <SelectTrigger id="profile">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingProfiles ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">Loading profiles...</div>
                      ) : (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Suppliers
                          </div>
                          {profiles.filter((p) => p.type === 'supplier').map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              <span className="flex flex-col text-left">
                                <span>{profile.displayName}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {profile.source === 'tenant' && 'Your supplier'}
                                  {profile.source === 'global' && `Shared · ${profile.tenantName ?? 'Global library'}`}
                                  {profile.source === 'static' && 'Built-in template'}
                                  {profile.source === 'link' && 'Linked to this quote'}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                            Software/Systems
                          </div>
                          {profiles.filter((p) => p.type === 'software').map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              <span className="flex flex-col text-left">
                                <span>{profile.displayName}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {profile.source === 'tenant' && 'Tenant software profile'}
                                  {profile.source === 'static' && 'Built-in template'}
                                  {profile.source === 'link' && 'Linked to this quote'}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {profiles.find((p) => p.id === supplierProfile)?.type === 'supplier'
                      ? '📦 Supplier quote (outsourced)'
                      : '🖥️ User software quote'}
                  </p>
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
                    disabled={isLoadingRemoteFile}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {selectedFile ? selectedFile.name : 'Choose PDF'}
                  </Button>
                  {queryQuoteId && queryFileId && (
                    <p
                      className={`text-xs mt-2 ${remoteFileError ? 'text-destructive' : 'text-muted-foreground'}`}
                    >
                      {isLoadingRemoteFile
                        ? 'Loading PDF from quote context...'
                        : remoteFileError
                        ? `Linked PDF unavailable (${remoteFileError}). Upload a file manually.`
                        : selectedFile
                        ? 'Using the PDF attached to this quote. Upload another file to replace it.'
                        : 'Select a PDF if you want to override the quote attachment.'}
                    </p>
                  )}
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
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleFocusAnnotation(box.id)}
                          title="Focus"
                        >
                          <Focus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive"
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

function extractFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? null;
}

function humanizeProfileId(profileId: string): string {
  if (!profileId) return 'Supplier profile';
  if (profileId.startsWith('sup_')) {
    return profileId
      .replace(/^sup_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return profileId;
}
