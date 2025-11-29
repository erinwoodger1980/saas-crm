"use client";
/**
 * Example Photo Gallery Component
 * Swipeable gallery for customers to browse and select examples
 * Pre-fills questionnaire based on selected example specs
 */

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
}

interface ExamplePhotoGalleryProps {
  tenantId: string;
  tags?: string[];
  productType?: string;
  onSelect?: (payload: { specifications: any; photo: ExamplePhoto }) => void;
  onClose?: () => void;
}

export default function ExamplePhotoGallery({
  tenantId,
  tags = [],
  productType,
  onSelect,
  onClose,
}: ExamplePhotoGalleryProps) {
  const [photos, setPhotos] = useState<ExamplePhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
  // tenantId provided by parent (branding.tenantId)

  useEffect(() => {
    loadPhotos();
  }, [tags, productType]);

  // Track view when photo shown
  useEffect(() => {
    if (photos[currentIndex]) {
      trackView(photos[currentIndex].id);
    }
  }, [currentIndex, photos]);

  async function loadPhotos() {
    try {
      const params = new URLSearchParams();
      if (tags.length > 0) params.set("tags", tags.join(","));
      if (productType) params.set("productType", productType);

      const resp = await fetch(
        `${apiBase}/example-photos/public/${tenantId}?${params.toString()}`
      );
      if (!resp.ok) throw new Error("Failed to load");
      
      const data = await resp.json();
      setPhotos(data);
    } catch (err) {
      console.error("Failed to load photos:", err);
    } finally {
      setLoading(false);
    }
  }

  async function trackView(photoId: string) {
    try {
      await fetch(`${apiBase}/example-photos/public/${photoId}/view`, {
        method: "POST",
      });
    } catch (err) {
      // Silent fail - analytics not critical
    }
  }

  async function handleSelect() {
    const photo = photos[currentIndex];
    if (!photo) return;

    try {
      const resp = await fetch(
        `${apiBase}/example-photos/public/${photo.id}/select`,
        { method: "POST" }
      );
      
      if (!resp.ok) throw new Error("Failed to select");
      
      const { specifications } = await resp.json();
      // Provide both specifications and selected photo metadata
      if (onSelect) {
        onSelect({ specifications, photo });
      }
      
      // Close gallery
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error("Failed to select photo:", err);
      alert("Failed to apply example");
    }
  }

  function nextPhoto() {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }

  function prevPhoto() {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading examples...
        </CardContent>
      </Card>
    );
  }

  if (photos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-4">
            No examples found for this product type
          </p>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Continue Without Example
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const currentPhoto = photos[currentIndex];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-muted">
          <img
            src={currentPhoto.imageUrl}
            alt={currentPhoto.title}
            className="w-full h-full object-cover"
          />
          
          {/* Navigation Arrows */}
          {photos.length > 1 && (
            <>
              <button
                onClick={prevPhoto}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={nextPhoto}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Counter */}
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-sm px-3 py-1 rounded-full">
            {currentIndex + 1} / {photos.length}
          </div>

          {/* Info Button */}
          <button
            onClick={() => setShowDetails(true)}
            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition"
          >
            <Info className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Info */}
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-lg">{currentPhoto.title}</h3>
            {currentPhoto.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {currentPhoto.description}
              </p>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {currentPhoto.tags.map(tag => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Key Specs */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {currentPhoto.widthMm && currentPhoto.heightMm && (
              <div>
                <span className="text-muted-foreground">Size:</span>
                <div className="font-medium">
                  {currentPhoto.widthMm}mm × {currentPhoto.heightMm}mm
                </div>
              </div>
            )}
            {currentPhoto.timberSpecies && (
              <div>
                <span className="text-muted-foreground">Timber:</span>
                <div className="font-medium">{currentPhoto.timberSpecies}</div>
              </div>
            )}
            {currentPhoto.finishType && (
              <div>
                <span className="text-muted-foreground">Finish:</span>
                <div className="font-medium">{currentPhoto.finishType}</div>
              </div>
            )}
            {currentPhoto.priceGBP && (
              <div>
                <span className="text-muted-foreground">Price:</span>
                <div className="font-medium text-lg">
                  £{currentPhoto.priceGBP.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSelect} className="flex-1 gap-2">
              <Check className="h-4 w-4" />
              Use This Example
            </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentPhoto.title}</DialogTitle>
            <DialogDescription>Full specification details</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {currentPhoto.description && (
              <div>
                <h4 className="font-semibold mb-1">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {currentPhoto.description}
                </p>
              </div>
            )}

            <div className="grid gap-3">
              {currentPhoto.widthMm && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Width:</span>
                  <span className="font-medium">{currentPhoto.widthMm}mm</span>
                </div>
              )}
              {currentPhoto.heightMm && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Height:</span>
                  <span className="font-medium">{currentPhoto.heightMm}mm</span>
                </div>
              )}
              {currentPhoto.thicknessMm && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Thickness:</span>
                  <span className="font-medium">{currentPhoto.thicknessMm}mm</span>
                </div>
              )}
              {currentPhoto.timberSpecies && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timber Species:</span>
                  <span className="font-medium">{currentPhoto.timberSpecies}</span>
                </div>
              )}
              {currentPhoto.glassType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Glass Type:</span>
                  <span className="font-medium">{currentPhoto.glassType}</span>
                </div>
              )}
              {currentPhoto.finishType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Finish:</span>
                  <span className="font-medium">{currentPhoto.finishType}</span>
                </div>
              )}
              {currentPhoto.fireRating && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fire Rating:</span>
                  <span className="font-medium">{currentPhoto.fireRating}</span>
                </div>
              )}
              {currentPhoto.priceGBP && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Approximate Price:</span>
                  <span className="font-semibold text-lg">
                    £{currentPhoto.priceGBP.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <Button onClick={handleSelect} className="w-full gap-2">
              <Check className="h-4 w-4" />
              Use This Example
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Swipe Instructions */}
      {photos.length > 1 && (
        <p className="text-xs text-center text-muted-foreground">
          Swipe or use arrows to browse {photos.length} examples
        </p>
      )}
    </div>
  );
}
