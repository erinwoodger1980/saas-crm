"use client";
/**
 * Example Photos Admin Interface
 * Upload and manage tagged example photos for customer gallery
 */

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Edit,
  Eye,
  TrendingUp,
  Tag,
  Save,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";

interface ExamplePhoto {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  tags: string[];
  productType?: string;
  widthMm?: number;
  heightMm?: number;
  thicknessMm?: number;
  timberSpecies?: string;
  glassType?: string;
  finishType?: string;
  fireRating?: string;
  priceGBP?: number;
  viewCount: number;
  selectionCount: number;
  displayOrder: number;
  uploadedBy?: { name?: string };
  isActive?: boolean;
}

export default function ExamplePhotosAdminPage() {
  const [photos, setPhotos] = useState<ExamplePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [enhancing, setEnhancing] = useState<string | null>(null);
  // Decoupled file selection vs actual upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Multi-upload support
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  // Edit modal
  const [editingPhoto, setEditingPhoto] = useState<ExamplePhoto | null>(null);
  const [editingFieldAnswers, setEditingFieldAnswers] = useState<Record<string, any>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  // Reorder state (photos already held in photos[]) - we will send order when changed
  const [reordering, setReordering] = useState(false);
  // Replace image state
  const [replaceUploading, setReplaceUploading] = useState(false);
  const [replacePreview, setReplacePreview] = useState<string | null>(null);
  // Keyboard reorder & announcements
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [ariaMessage, setAriaMessage] = useState<string>("");
  const reorderAnnounceRef = React.useRef<HTMLDivElement | null>(null);

  // Bulk selection & tag editing
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [bulkTagInput, setBulkTagInput] = useState<string>("");
  const [bulkRemoveTagInput, setBulkRemoveTagInput] = useState<string>("");
  const [reorderHistory, setReorderHistory] = useState<string[][]>([]);
  const allSelected = selectedPhotoIds.length > 0 && selectedPhotoIds.length === photos.length;
  // Filters
  const [filterTag, setFilterTag] = useState<string>("");
  const [filterActive, setFilterActive] = useState<string>("all"); // all | active | inactive
  const [filterProductType, setFilterProductType] = useState<string>("");

  // Safely normalize field options from JSON or CSV strings
  function normalizeOptions(raw: any): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((v) => String(v)).filter(Boolean);
    const text = String(raw);
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
    } catch {}
    return text
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function toggleSelect(id: string) {
    setSelectedPhotoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function selectAll() { setSelectedPhotoIds(photos.map(p => p.id)); }
  function clearSelection() { setSelectedPhotoIds([]); }

  async function applyBulkAddTag() {
    const tag = bulkTagInput.trim();
    if (!tag || selectedPhotoIds.length === 0) return;
    try {
      await Promise.all(selectedPhotoIds.map(id => {
        const current = photos.find(p => p.id === id);
        if (!current) return Promise.resolve();
        const tags = current.tags.includes(tag) ? current.tags : [...current.tags, tag];
        return fetch(`${apiBase}/example-photos/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags })
        });
      }));
      setBulkTagInput('');
      await loadPhotos();
    } catch (e) {
      console.error(e); alert('Bulk add tag failed');
    }
  }

  async function applyBulkRemoveTag() {
    const tag = bulkRemoveTagInput.trim();
    if (!tag || selectedPhotoIds.length === 0) return;
    try {
      await Promise.all(selectedPhotoIds.map(id => {
        const current = photos.find(p => p.id === id);
        if (!current) return Promise.resolve();
        const tags = current.tags.filter(t => t !== tag);
        return fetch(`${apiBase}/example-photos/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags })
        });
      }));
      setBulkRemoveTagInput('');
      await loadPhotos();
    } catch (e) {
      console.error(e); alert('Bulk remove tag failed');
    }
  }

  async function applyBulkSetActive(next: boolean) {
    if (selectedPhotoIds.length === 0) return;
    try {
      await Promise.all(selectedPhotoIds.map(id => fetch(`${apiBase}/example-photos/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: next })
      })));
      await loadPhotos();
    } catch (e) {
      console.error(e); alert('Bulk status update failed');
    }
  }

  function announce(msg: string) {
    setAriaMessage(msg);
    // Force reflow for screen readers
    if (reorderAnnounceRef.current) {
      reorderAnnounceRef.current.textContent = msg;
    }
  }
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tags: [] as string[],
    tagInput: "",
    productType: "",
    widthMm: "",
    heightMm: "",
    thicknessMm: "",
    timberSpecies: "",
    glassType: "",
    finishType: "",
    fireRating: "",
    priceGBP: "",
    supplierName: "",
    fieldAnswers: {} as Record<string, any>, // Questionnaire field answers
  });
  
  // Available questionnaire fields
  const [questionnaireFields, setQuestionnaireFields] = useState<any[]>([]);
  
  // Resolve API base (fallback to same-origin /api proxy)
  // Use NEXT_PUBLIC_API_BASE which is set in Render for production/staging
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "/api");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantError, setTenantError] = useState<string | null>(null);

  useEffect(() => {
    // Load tenant settings to obtain real tenantId
    (async () => {
      setTenantLoading(true);
      try {
        const resp = await fetch(`${apiBase}/tenant/settings`, { credentials: 'include' });
        if (!resp.ok) throw new Error(`settings ${resp.status}`);
        const data = await resp.json();
        if (data?.tenantId) setTenantId(data.tenantId);
        else throw new Error('missing tenantId');
      } catch (e: any) {
        console.error('Failed to load tenant settings', e);
        setTenantError(e?.message || 'tenant settings failed');
      } finally {
        setTenantLoading(false);
      }
    })();
  }, [apiBase]);

  // Load dependent data once tenantId resolved
  useEffect(() => {
    if (!tenantId) return;
    loadPhotos();
    loadAnalytics();
    loadQuestionnaireFields();
  }, [tenantId]);

  async function loadPhotos() {
    if (!tenantId) return;
    try {
      const resp = await fetch(`${apiBase}/example-photos/${tenantId}`, { credentials: 'include' });
      if (!resp.ok) throw new Error("Failed to load");
      const data = await resp.json();
      setPhotos(data);
    } catch (err) {
      console.error("Failed to load photos:", err);
    } finally {
      setLoading(false);
    }
  }

  async function submitReorder(next: ExamplePhoto[]) {
    if (!next.length) return;
    setReordering(true);
    try {
      const resp = await fetch(`${apiBase}/example-photos/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: next.map(p => p.id) }),
        credentials: 'include',
      });
      if (!resp.ok) throw new Error('Reorder failed');
      setPhotos(next);
    } catch (err) {
      console.error('Reorder failed', err);
      alert('Failed to reorder');
    } finally {
      setReordering(false);
    }
  }

  function submitReorderWithHistory(next: ExamplePhoto[]) {
    setReorderHistory(prev => [...prev, photos.map(p => p.id)]);
    submitReorder(next);
  }

  function undoLastReorder() {
    const last = reorderHistory[reorderHistory.length - 1];
    if (!last) return;
    const idToPhoto = new Map(photos.map(p => [p.id, p]));
    const restored: ExamplePhoto[] = last.map(id => idToPhoto.get(id)!).filter(Boolean);
    setPhotos(restored);
    setReorderHistory(prev => prev.slice(0, -1));
    submitReorder(restored);
    announce('Reorder undone');
  }

  async function loadAnalytics() {
    if (!tenantId) return;
    try {
      const resp = await fetch(`${apiBase}/example-photos/${tenantId}/analytics`, { credentials: 'include' });
      if (!resp.ok) throw new Error("Failed to load analytics");
      const data = await resp.json();
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    }
  }

  async function loadQuestionnaireFields() {
    if (!tenantId) return;
    try {
      const resp = await fetch(`${apiBase}/fields?tenantId=${tenantId}`);
      if (!resp.ok) throw new Error("Failed to load fields");
      const data = await resp.json();
      // Group by standard fields
      const standardFields = data.filter((f: any) => f.isStandard && f.isActive);
      setQuestionnaireFields(standardFields);
    } catch (err) {
      console.error("Failed to load questionnaire fields:", err);
    }
  }

  function addTag() {
    if (formData.tagInput.trim()) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, prev.tagInput.trim()],
        tagInput: "",
      }));
    }
  }

  function removeTag(tag: string) {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // Single file legacy preview (keep for compatibility)
    setSelectedFile(files[0]);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(files[0]));
    // Multi preview
    setSelectedFiles(prev => [...prev, ...files]);
    setFilePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  }

  async function performUpload() {
    if ((!selectedFile && selectedFiles.length === 0) || !tenantId) {
      alert(!tenantId ? 'Tenant not loaded' : 'No file selected');
      return;
    }
    if (!formData.title.trim()) {
      alert('Title is required before upload.');
      return;
    }
    setUploading(true);
    try {
      const toUpload = selectedFiles.length > 0 ? selectedFiles : (selectedFile ? [selectedFile] : []);
      for (const file of toUpload) {
        const form = new FormData();
        form.append('image', file);
        form.append('metadata', JSON.stringify({
          title: formData.title,
          description: formData.description,
          tags: formData.tags,
          productType: formData.productType || undefined,
          widthMm: formData.widthMm ? parseInt(formData.widthMm) : undefined,
          heightMm: formData.heightMm ? parseInt(formData.heightMm) : undefined,
          thicknessMm: formData.thicknessMm ? parseInt(formData.thicknessMm) : undefined,
          timberSpecies: formData.timberSpecies || undefined,
          glassType: formData.glassType || undefined,
          finishType: formData.finishType || undefined,
          fireRating: formData.fireRating || undefined,
          priceGBP: formData.priceGBP ? parseFloat(formData.priceGBP) : undefined,
          supplierName: formData.supplierName || undefined,
          fieldAnswers: formData.fieldAnswers && Object.keys(formData.fieldAnswers).length ? formData.fieldAnswers : undefined,
        }));
        // Track progress using fetch + xhr fallback
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${apiBase}/example-photos/${tenantId}/upload`);
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error(`Upload failed (${xhr.status})`));
          };
          xhr.onerror = () => reject(new Error('Network error'));
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              setUploadProgress(prev => ({ ...prev, [file.name]: Math.round((ev.loaded / ev.total) * 100) }));
            }
          };
          xhr.send(form);
        });
      }
      await loadPhotos();
      // Reset
      setFormData({
        title: '', description: '', tags: [], tagInput: '', productType: '', widthMm: '', heightMm: '', thicknessMm: '', timberSpecies: '', glassType: '', finishType: '', fireRating: '', priceGBP: '', supplierName: '', fieldAnswers: {},
      });
      setSelectedFile(null);
      setSelectedFiles([]);
      filePreviews.forEach(p => URL.revokeObjectURL(p));
      setFilePreviews([]);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setUploadProgress({});
    } catch (err: any) {
      console.error('Upload failed:', err);
      alert(`Failed to upload photo(s): ${err?.message || 'error'}`);
    } finally {
      setUploading(false);
    }
  }

  function removeSelectedFile(idx: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
    setFilePreviews(prev => {
      const toRemove = prev[idx];
      if (toRemove) URL.revokeObjectURL(toRemove);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function onDrop(ev: React.DragEvent<HTMLDivElement>) {
    ev.preventDefault();
    const files = Array.from(ev.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) {
      setSelectedFiles(prev => [...prev, ...files]);
      setFilePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
      if (!selectedFile) {
        setSelectedFile(files[0]);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(files[0]));
      }
    }
  }

  function onDragOver(ev: React.DragEvent<HTMLDivElement>) {
    ev.preventDefault();
  }

  async function openEdit(photo: ExamplePhoto) {
    setEditingPhoto(photo);
    setSavingEdit(false);
    setEditingFieldAnswers({});
    // Optionally load field answers (not implemented yet; would require extra fetch)
    try {
      const resp = await fetch(`${apiBase}/example-photos/${photo.id}/field-answers`);
      if (resp.ok) {
        const data = await resp.json();
        // Flatten to value map
        const answers: Record<string, any> = {};
        Object.entries(data).forEach(([k, v]: any) => { answers[k] = (v as any)?.value; });
        setEditingFieldAnswers(answers);
      }
    } catch (e) {
      console.warn('Failed to load field answers', e);
    }
  }

  async function saveEdit() {
    if (!editingPhoto) return;
    setSavingEdit(true);
    try {
      const payload: any = {
        title: editingPhoto.title,
        description: editingPhoto.description,
        widthMm: editingPhoto.widthMm,
        heightMm: editingPhoto.heightMm,
        thicknessMm: editingPhoto.thicknessMm,
        timberSpecies: editingPhoto.timberSpecies,
        glassType: editingPhoto.glassType,
        finishType: editingPhoto.finishType,
        fireRating: editingPhoto.fireRating,
        priceGBP: editingPhoto.priceGBP,
        productType: editingPhoto.productType,
        tags: editingPhoto.tags,
        fieldAnswers: editingFieldAnswers,
      };
      const resp = await fetch(`${apiBase}/example-photos/${editingPhoto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error('Save failed');
      await loadPhotos();
      setEditingPhoto(null);
    } catch (err: any) {
      console.error('Edit save failed', err);
      alert(err?.message || 'Failed to save');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleReplaceImage(file: File) {
    if (!editingPhoto) return;
    setReplaceUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const resp = await fetch(`${apiBase}/example-photos/${editingPhoto.id}/replace-image`, {
        method: 'POST',
        body: form,
      });
      if (!resp.ok) throw new Error('Replace failed');
      const data = await resp.json();
      // Update local photo object
      setEditingPhoto(prev => prev ? { ...prev, imageUrl: data.photo.imageUrl, thumbnailUrl: data.photo.thumbnailUrl } : prev);
      await loadPhotos();
      alert('Image replaced successfully');
      if (replacePreview) URL.revokeObjectURL(replacePreview);
      setReplacePreview(null);
    } catch (err: any) {
      console.error('Replace failed', err);
      alert(err?.message || 'Failed to replace image');
    } finally {
      setReplaceUploading(false);
    }
  }

  async function deletePhoto(id: string) {
    if (!confirm("Delete this example photo?")) return;
    if (!tenantId) return;

    try {
      await fetch(`${apiBase}/example-photos/${id}`, { method: "DELETE" });
      await loadPhotos();
      await loadAnalytics();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete");
    }
  }

  async function enhancePhoto(id: string) {
    if (!confirm("Enhance this photo with AI? This will replace the current image.")) return;
    if (!tenantId) return;

    setEnhancing(id);
    try {
      const resp = await fetch(`${apiBase}/example-photos/${id}/enhance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "professional",
          removeBackground: false,
        }),
      });

      if (!resp.ok) throw new Error("Enhancement failed");

      const result = await resp.json();
      
      await loadPhotos();
      
      alert(`Photo enhanced successfully using ${result.method === "AI" ? "AI enhancement" : "basic enhancement"}!`);
    } catch (err) {
      console.error("Enhancement failed:", err);
      alert("Failed to enhance photo");
    } finally {
      setEnhancing(null);
    }
  }

  return (
    <div className="container mx-auto max-w-7xl py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Example Photo Gallery</h1>
        <p className="text-muted-foreground">
          Upload tagged examples for customers to browse and select
        </p>
        {tenantLoading && (
          <p className="text-xs text-muted-foreground">Loading tenant…</p>
        )}
        {tenantError && !tenantLoading && (
          <p className="text-xs text-red-600">Tenant error: {tenantError}</p>
        )}
        {!tenantLoading && !tenantError && !tenantId && (
          <p className="text-xs text-red-600">Tenant ID unavailable – uploads disabled.</p>
        )}
      </div>

      {/* Analytics */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalPhotos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalViews}</div>
              <p className="text-xs text-muted-foreground">
                Avg: {analytics.averageViewsPerPhoto.toFixed(1)} per photo
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Selections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalSelections}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.conversionRate.toFixed(1)}% conversion rate
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {analytics.topPhotos[0]?.title || "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics.topPhotos[0]?.selectionCount || 0} selections
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>Upload New Example</CardTitle>
            <CardDescription>Add a tagged photo with specifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Oak Entrance Door"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Solid oak entrance door with glazed panels..."
                rows={3}
              />
              {formData.title && !tenantId && (
                <p className="text-xs text-red-500">Tenant not loaded yet – wait then retry.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.tagInput}
                  onChange={e => setFormData(prev => ({ ...prev, tagInput: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
                  placeholder="entrance, external, glazed..."
                />
                <Button onClick={addTag} size="sm">
                  <Tag className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="widthMm">Width (mm)</Label>
                <Input
                  id="widthMm"
                  type="number"
                  value={formData.widthMm}
                  onChange={e => setFormData(prev => ({ ...prev, widthMm: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="heightMm">Height (mm)</Label>
                <Input
                  id="heightMm"
                  type="number"
                  value={formData.heightMm}
                  onChange={e => setFormData(prev => ({ ...prev, heightMm: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timberSpecies">Timber Species</Label>
              <Input
                id="timberSpecies"
                value={formData.timberSpecies}
                onChange={e => setFormData(prev => ({ ...prev, timberSpecies: e.target.value }))}
                placeholder="Oak, Pine, Ash..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="finishType">Finish</Label>
              <Input
                id="finishType"
                value={formData.finishType}
                onChange={e => setFormData(prev => ({ ...prev, finishType: e.target.value }))}
                placeholder="Painted, Stained, Lacquered..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priceGBP">Price (GBP)</Label>
              <Input
                id="priceGBP"
                type="number"
                step="0.01"
                value={formData.priceGBP}
                onChange={e => setFormData(prev => ({ ...prev, priceGBP: e.target.value }))}
              />
            </div>

            {/* All Standard Questionnaire Fields */}
            {questionnaireFields.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold">Complete Questionnaire Answers</Label>
                  <Badge variant="secondary">Optional</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tag this photo with answers to all standard questions for better matching
                </p>
                
                <div className="grid gap-3 max-h-64 overflow-y-auto pr-2">
                  {questionnaireFields.map((field: any) => (
                    <div key={field.id} className="space-y-1">
                      <Label htmlFor={`field_${field.key}`} className="text-xs">
                        {field.label}
                      </Label>
                      {field.type === "SELECT" && field.options ? (
                        <select
                          id={`field_${field.key}`}
                          className="w-full px-2 py-1 text-sm border rounded"
                          value={formData.fieldAnswers[field.key] || ""}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            fieldAnswers: { ...prev.fieldAnswers, [field.key]: e.target.value }
                          }))}
                        >
                          <option value="">-- Select --</option>
                          {normalizeOptions(field.options).map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === "NUMBER" ? (
                        <Input
                          id={`field_${field.key}`}
                          type="number"
                          className="text-sm"
                          value={formData.fieldAnswers[field.key] || ""}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            fieldAnswers: { ...prev.fieldAnswers, [field.key]: e.target.value }
                          }))}
                          placeholder={field.placeholder || ""}
                        />
                      ) : field.type === "BOOLEAN" ? (
                        <div className="flex items-center gap-2">
                          <input
                            id={`field_${field.key}`}
                            type="checkbox"
                            checked={formData.fieldAnswers[field.key] === "true"}
                            onChange={e => setFormData(prev => ({
                              ...prev,
                              fieldAnswers: { ...prev.fieldAnswers, [field.key]: e.target.checked ? "true" : "false" }
                            }))}
                          />
                          <label htmlFor={`field_${field.key}`} className="text-xs">Yes</label>
                        </div>
                      ) : (
                        <Input
                          id={`field_${field.key}`}
                          type="text"
                          className="text-sm"
                          value={formData.fieldAnswers[field.key] || ""}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            fieldAnswers: { ...prev.fieldAnswers, [field.key]: e.target.value }
                          }))}
                          placeholder={field.placeholder || ""}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-4">
              <Label htmlFor="image">Choose Photos *</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelected}
                disabled={uploading || !tenantId}
              />
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                className="mt-2 border-2 border-dashed rounded-xl p-4 text-center text-xs text-muted-foreground hover:bg-muted/50 transition"
              >
                Drag & drop images here
              </div>
              {!tenantId && <p className="text-xs text-red-500">Tenant not loaded yet – wait then retry.</p>}
              {(previewUrl || filePreviews.length > 0) && (
                <div className="mt-2 grid gap-2 grid-cols-3">
                  {filePreviews.map((p, i) => (
                    <div key={p} className="relative group border rounded overflow-hidden">
                      <img src={p} alt={`Preview ${i+1}`} className="h-24 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(i)}
                        className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                      {uploadProgress[selectedFiles[i]?.name] != null && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/40 h-4 flex items-center">
                          <div
                            className="h-4 bg-emerald-400 text-[10px] text-black font-semibold flex items-center justify-center"
                            style={{ width: `${uploadProgress[selectedFiles[i].name]}%` }}
                          >
                            {uploadProgress[selectedFiles[i].name]}%
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                onClick={performUpload}
                disabled={uploading || !formData.title || (!selectedFile && selectedFiles.length === 0) || !tenantId}
                className="w-full"
              >
                {uploading ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</span>
                ) : (
                  <span className="flex items-center gap-2"><Upload className="h-4 w-4" /> {selectedFiles.length > 1 ? `Upload ${selectedFiles.length} Photos` : 'Upload Photo'}</span>
                )}
              </Button>
              {!formData.title && <p className="text-xs text-muted-foreground">Enter title before uploading.</p>}
              {selectedFiles.length === 0 && <p className="text-xs text-muted-foreground">Select or drop image files.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Photo Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Example Photos ({photos.length})</h2>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : photos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No example photos yet. Upload your first example!</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {selectedPhotoIds.length > 0 && (
                <div className="sticky top-0 z-30 mb-2 bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-wrap gap-2 items-center text-xs">
                  <span className="font-semibold">{selectedPhotoIds.length} selected</span>
                  <Button size="sm" variant="outline" onClick={selectAll} disabled={allSelected}>Select All</Button>
                  <Button size="sm" variant="destructive" onClick={clearSelection}>Clear</Button>
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-7 text-xs w-28"
                      placeholder="Add tag"
                      value={bulkTagInput}
                      onChange={e => setBulkTagInput(e.target.value)}
                    />
                    <Button size="sm" variant="outline" disabled={!bulkTagInput.trim()} onClick={applyBulkAddTag}>Add</Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-7 text-xs w-32"
                      placeholder="Remove tag"
                      value={bulkRemoveTagInput}
                      onChange={e => setBulkRemoveTagInput(e.target.value)}
                    />
                    <Button size="sm" variant="outline" disabled={!bulkRemoveTagInput.trim()} onClick={applyBulkRemoveTag}>Remove</Button>
                  </div>
                  <Button size="sm" onClick={() => applyBulkSetActive(true)} disabled={!selectedPhotoIds.length}>Activate</Button>
                  <Button size="sm" variant="secondary" onClick={() => applyBulkSetActive(false)} disabled={!selectedPhotoIds.length}>Deactivate</Button>
                  <Button size="sm" variant="outline" onClick={undoLastReorder} disabled={!reorderHistory.length}>Undo Reorder</Button>
                </div>
              )}
              {/* Filters */}
              <div className="flex flex-wrap gap-3 items-end mb-2 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-medium">Tag Filter</label>
                  <Input
                    className="h-8 text-xs w-40"
                    placeholder="tag contains…"
                    value={filterTag}
                    onChange={e => setFilterTag(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium">Active</label>
                  <select
                    value={filterActive}
                    onChange={e => setFilterActive(e.target.value)}
                    className="h-8 text-xs border rounded px-2"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium">Product Type</label>
                  <Input
                    className="h-8 text-xs w-40"
                    placeholder="product type"
                    value={filterProductType}
                    onChange={e => setFilterProductType(e.target.value)}
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() => {setFilterTag(''); setFilterActive('all'); setFilterProductType('');}}>Reset Filters</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {photos
                  .filter(p => !filterTag || p.tags.some(t => t.toLowerCase().includes(filterTag.toLowerCase())))
                  .filter(p => filterActive === 'all' || (filterActive === 'active' ? p.isActive !== false : p.isActive === false))
                  .filter(p => !filterProductType || (p.productType || '').toLowerCase().includes(filterProductType.toLowerCase()))
                  .map((photo, index) => (
                <Card
                  key={photo.id}
                  className="overflow-hidden"
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('text/plain', photo.id);
                    setActiveDragId(photo.id);
                    announce(`Picked up ${photo.title}`);
                  }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (!draggedId || draggedId === photo.id) return;
                    setPhotos(prev => {
                      const draggedIdx = prev.findIndex(p => p.id === draggedId);
                      const targetIdx = prev.findIndex(p => p.id === photo.id);
                      if (draggedIdx === -1 || targetIdx === -1) return prev;
                      const copy = prev.slice();
                      const [item] = copy.splice(draggedIdx, 1);
                      copy.splice(targetIdx, 0, item);
                      submitReorderWithHistory(copy);
                      announce(`${item.title} moved to position ${targetIdx + 1}`);
                      return copy;
                    });
                    setActiveDragId(null);
                  }}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      if (activeDragId === photo.id) {
                        setActiveDragId(null);
                        announce(`Dropped ${photo.title} at position ${index + 1}`);
                      } else {
                        setActiveDragId(photo.id);
                        announce(`Ready to move ${photo.title}. Use arrow keys.`);
                      }
                    }
                    if (activeDragId === photo.id && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                      e.preventDefault();
                      setPhotos(prev => {
                        const idx = prev.findIndex(p => p.id === photo.id);
                        if (idx === -1) return prev;
                        const copy = prev.slice();
                        const dir = e.key === 'ArrowUp' ? -1 : 1;
                        const newIdx = idx + dir;
                        if (newIdx < 0 || newIdx >= copy.length) return prev;
                        const [item] = copy.splice(idx, 1);
                        copy.splice(newIdx, 0, item);
                        submitReorderWithHistory(copy);
                        announce(`${item.title} moved to position ${newIdx + 1}`);
                        return copy;
                      });
                    }
                    if (e.key === 'Escape' && activeDragId === photo.id) {
                      setActiveDragId(null);
                      announce(`Cancelled move for ${photo.title}`);
                    }
                  }}
                  aria-grabbed={activeDragId === photo.id}
                  aria-label={`Photo card ${photo.title}, position ${index + 1}${activeDragId === photo.id ? ' moving' : ''}`}
                >
                  <div className="aspect-video relative bg-muted cursor-move">
                    <img
                      src={photo.thumbnailUrl || photo.imageUrl}
                      alt={photo.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1 flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={reordering}
                        onClick={() => {
                          setPhotos(prev => {
                            const idx = prev.findIndex(p => p.id === photo.id);
                            if (idx <= 0) return prev;
                            const copy = prev.slice();
                            const [item] = copy.splice(idx, 1);
                            copy.splice(idx - 1, 0, item);
                            submitReorderWithHistory(copy);
                            return copy;
                          });
                        }}
                        className="bg-black/40 hover:bg-black/60 text-white text-[10px] px-1 py-0.5 rounded"
                        title="Move up"
                      >↑</button>
                      <button
                        type="button"
                        disabled={reordering}
                        onClick={() => {
                          setPhotos(prev => {
                            const idx = prev.findIndex(p => p.id === photo.id);
                            if (idx === -1 || idx >= prev.length - 1) return prev;
                            const copy = prev.slice();
                            const [item] = copy.splice(idx, 1);
                            copy.splice(idx + 1, 0, item);
                            submitReorderWithHistory(copy);
                            return copy;
                          });
                        }}
                        className="bg-black/40 hover:bg-black/60 text-white text-[10px] px-1 py-0.5 rounded"
                        title="Move down"
                      >↓</button>
                    </div>
                    <div className="absolute top-1 right-1">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border"
                        checked={selectedPhotoIds.includes(photo.id)}
                        onChange={() => toggleSelect(photo.id)}
                        aria-label={`Select photo ${photo.title}`}
                      />
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-semibold line-clamp-1">{photo.title}</h3>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className={`px-2 py-0.5 rounded-full border ${photo.isActive === false ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{photo.isActive === false ? 'Inactive' : 'Active'}</span>
                      <button
                        type="button"
                        className="underline text-xs"
                        onClick={async () => {
                          try {
                            await fetch(`${apiBase}/example-photos/${photo.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: photo.isActive === false }) });
                            await loadPhotos();
                          } catch(e) { alert('Status toggle failed'); }
                        }}
                      >Toggle</button>
                    </div>
                    {photo.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {photo.description}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-1">
                      {photo.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {photo.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{photo.tags.length - 3}
                        </Badge>
                      )}
                    </div>

                    {(photo.widthMm || photo.heightMm) && (
                      <div className="text-xs text-muted-foreground">
                        {photo.widthMm}mm × {photo.heightMm}mm
                      </div>
                    )}

                    {photo.priceGBP && (
                      <div className="text-sm font-semibold">
                        £{photo.priceGBP.toFixed(2)}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {photo.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {photo.selectionCount}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => enhancePhoto(photo.id)}
                        disabled={enhancing === photo.id}
                        className="flex-1"
                        title="AI enhance photo"
                      >
                        {enhancing === photo.id ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Enhancing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            Enhance
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(photo)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deletePhoto(photo.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Live region for reorder announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" ref={reorderAnnounceRef}>{ariaMessage}</div>
      {editingPhoto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Edit Photo</h2>
            <div className="flex items-start gap-4">
              <div className="w-40 aspect-video rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
                <img
                  src={replacePreview || editingPhoto.thumbnailUrl || editingPhoto.imageUrl}
                  alt={editingPhoto.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Replace Image</Label>
                <Input
                  type="file"
                  accept="image/*"
                  disabled={replaceUploading}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (replacePreview) URL.revokeObjectURL(replacePreview);
                    setReplacePreview(URL.createObjectURL(f));
                    handleReplaceImage(f);
                  }}
                />
                {replaceUploading && <p className="text-xs text-muted-foreground">Replacing image…</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={editingPhoto.title}
                onChange={e => setEditingPhoto(prev => prev ? { ...prev, title: e.target.value } : prev)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editingPhoto.description || ''}
                onChange={e => setEditingPhoto(prev => prev ? { ...prev, description: e.target.value } : prev)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {editingPhoto.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setEditingPhoto(prev => prev ? { ...prev, tags: prev.tags.filter(t => t !== tag) } : prev)} />
                  </Badge>
                ))}
                <Input
                  placeholder="Add tag"
                  className="w-32"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) setEditingPhoto(prev => prev ? { ...prev, tags: [...prev.tags, val] } : prev);
                      (e.target as HTMLInputElement).value='';
                    }
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Width (mm)</Label>
                <Input
                  type="number"
                  value={editingPhoto.widthMm || ''}
                  onChange={e => setEditingPhoto(prev => prev ? { ...prev, widthMm: e.target.value ? parseInt(e.target.value) : undefined } : prev)}
                />
              </div>
              <div>
                <Label>Height (mm)</Label>
                <Input
                  type="number"
                  value={editingPhoto.heightMm || ''}
                  onChange={e => setEditingPhoto(prev => prev ? { ...prev, heightMm: e.target.value ? parseInt(e.target.value) : undefined } : prev)}
                />
              </div>
              <div>
                <Label>Thickness (mm)</Label>
                <Input
                  type="number"
                  value={editingPhoto.thicknessMm || ''}
                  onChange={e => setEditingPhoto(prev => prev ? { ...prev, thicknessMm: e.target.value ? parseInt(e.target.value) : undefined } : prev)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Timber Species</Label>
                <Input value={editingPhoto.timberSpecies || ''} onChange={e => setEditingPhoto(prev => prev ? { ...prev, timberSpecies: e.target.value || undefined } : prev)} />
              </div>
              <div>
                <Label>Finish Type</Label>
                <Input value={editingPhoto.finishType || ''} onChange={e => setEditingPhoto(prev => prev ? { ...prev, finishType: e.target.value || undefined } : prev)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Glass Type</Label>
                <Input value={editingPhoto.glassType || ''} onChange={e => setEditingPhoto(prev => prev ? { ...prev, glassType: e.target.value || undefined } : prev)} />
              </div>
              <div>
                <Label>Fire Rating</Label>
                <Input value={editingPhoto.fireRating || ''} onChange={e => setEditingPhoto(prev => prev ? { ...prev, fireRating: e.target.value || undefined } : prev)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price (GBP)</Label>
                <Input type="number" step="0.01" value={editingPhoto.priceGBP || ''} onChange={e => setEditingPhoto(prev => prev ? { ...prev, priceGBP: e.target.value ? parseFloat(e.target.value) : undefined } : prev)} />
              </div>
              <div>
                <Label>Product Type</Label>
                <Input value={editingPhoto.productType || ''} onChange={e => setEditingPhoto(prev => prev ? { ...prev, productType: e.target.value || undefined } : prev)} />
              </div>
            </div>
            {questionnaireFields.length > 0 && (
              <div className="space-y-3 pt-2 border-t">
                <h3 className="text-sm font-semibold">Questionnaire Answers</h3>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {questionnaireFields.map(f => (
                    <div key={f.id} className="space-y-1">
                      <Label className="text-xs">{f.label}</Label>
                      {f.type === 'SELECT' && f.options ? (
                        <select
                          className="w-full border rounded px-2 py-1 text-xs"
                          value={editingFieldAnswers[f.key] || ''}
                          onChange={e => setEditingFieldAnswers(prev => ({ ...prev, [f.key]: e.target.value }))}
                        >
                          <option value="">--</option>
                          {normalizeOptions(f.options).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : f.type === 'NUMBER' ? (
                        <Input
                          type="number"
                          className="text-xs"
                          value={editingFieldAnswers[f.key] || ''}
                          onChange={e => setEditingFieldAnswers(prev => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      ) : f.type === 'BOOLEAN' ? (
                        <label className="inline-flex items-center gap-1 text-[11px]">
                          <input
                            type="checkbox"
                            checked={editingFieldAnswers[f.key] === 'true'}
                            onChange={e => setEditingFieldAnswers(prev => ({ ...prev, [f.key]: e.target.checked ? 'true' : 'false' }))}
                          />
                          Yes
                        </label>
                      ) : (
                        <Input
                          type="text"
                          className="text-xs"
                          value={editingFieldAnswers[f.key] || ''}
                          onChange={e => setEditingFieldAnswers(prev => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditingPhoto(null)}>Cancel</Button>
              <Button size="sm" onClick={saveEdit} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save Changes'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
