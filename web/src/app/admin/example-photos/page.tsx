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
}

export default function ExamplePhotosAdminPage() {
  const [photos, setPhotos] = useState<ExamplePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  
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
  });
  
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
  const tenantId = "demo-tenant-id"; // TODO: Get from auth

  useEffect(() => {
    loadPhotos();
    loadAnalytics();
  }, []);

  async function loadPhotos() {
    try {
      const resp = await fetch(`${apiBase}/example-photos/${tenantId}`);
      if (!resp.ok) throw new Error("Failed to load");
      const data = await resp.json();
      setPhotos(data);
    } catch (err) {
      console.error("Failed to load photos:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics() {
    try {
      const resp = await fetch(`${apiBase}/example-photos/${tenantId}/analytics`);
      if (!resp.ok) throw new Error("Failed to load analytics");
      const data = await resp.json();
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const form = new FormData();
      form.append("image", file);
      form.append("metadata", JSON.stringify({
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
      }));

      const resp = await fetch(`${apiBase}/example-photos/${tenantId}/upload`, {
        method: "POST",
        body: form,
      });

      if (!resp.ok) throw new Error("Upload failed");

      await loadPhotos();
      
      // Reset form
      setFormData({
        title: "",
        description: "",
        tags: [],
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
      });
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(id: string) {
    if (!confirm("Delete this example photo?")) return;

    try {
      await fetch(`${apiBase}/example-photos/${id}`, { method: "DELETE" });
      await loadPhotos();
      await loadAnalytics();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete");
    }
  }

  return (
    <div className="container mx-auto max-w-7xl py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Example Photo Gallery</h1>
        <p className="text-muted-foreground">
          Upload tagged examples for customers to browse and select
        </p>
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

            <div className="space-y-2">
              <Label htmlFor="image">Photo *</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleUpload}
                disabled={uploading || !formData.title}
              />
              {!formData.title && (
                <p className="text-xs text-muted-foreground">Enter title first</p>
              )}
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map(photo => (
                <Card key={photo.id} className="overflow-hidden">
                  <div className="aspect-video relative bg-muted">
                    <img
                      src={photo.thumbnailUrl || photo.imageUrl}
                      alt={photo.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-semibold line-clamp-1">{photo.title}</h3>
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
                        onClick={() => setEditingId(photo.id)}
                        className="flex-1"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
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
          )}
        </div>
      </div>
    </div>
  );
}
