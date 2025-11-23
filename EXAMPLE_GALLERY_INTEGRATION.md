/**
 * EXAMPLE PHOTO GALLERY INTEGRATION
 * 
 * How to integrate the example photo gallery into your questionnaire page
 */

import ExamplePhotoGallery from "@/components/example-photo-gallery";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Image } from "lucide-react";

function QuestionnairePageWithGallery() {
  const [showGallery, setShowGallery] = useState(false);
  const [formData, setFormData] = useState({
    widthMm: "",
    heightMm: "",
    thicknessMm: "",
    timberSpecies: "",
    glassType: "",
    finishType: "",
    fireRating: "",
    // ... other fields
  });

  // Handle specs returned from gallery selection
  function handleExampleSelect(specs: any) {
    setFormData(prev => ({
      ...prev,
      // Pre-fill fields from selected example
      widthMm: specs.widthMm?.toString() || prev.widthMm,
      heightMm: specs.heightMm?.toString() || prev.heightMm,
      thicknessMm: specs.thicknessMm?.toString() || prev.thicknessMm,
      timberSpecies: specs.timberSpecies || prev.timberSpecies,
      glassType: specs.glassType || prev.glassType,
      finishType: specs.finishType || prev.finishType,
      fireRating: specs.fireRating || prev.fireRating,
    }));
    
    setShowGallery(false);
    
    // Optional: Show confirmation
    alert("Example applied! Fields have been pre-filled.");
  }

  return (
    <div className="space-y-6">
      <h1>Get Your Quote</h1>

      {/* Button to show gallery */}
      {!showGallery && (
        <Button onClick={() => setShowGallery(true)} variant="outline" className="w-full gap-2">
          <Image className="h-4 w-4" />
          Browse Example Photos
        </Button>
      )}

      {/* Example Photo Gallery */}
      {showGallery && (
        <ExamplePhotoGallery
          tags={["entrance", "external"]} // Filter by tags
          productType="door" // Filter by product type
          onSelect={handleExampleSelect}
          onClose={() => setShowGallery(false)}
        />
      )}

      {/* Questionnaire Form */}
      <form className="space-y-4">
        <div>
          <label>Width (mm)</label>
          <input
            type="number"
            value={formData.widthMm}
            onChange={e => setFormData(prev => ({ ...prev, widthMm: e.target.value }))}
          />
        </div>

        <div>
          <label>Height (mm)</label>
          <input
            type="number"
            value={formData.heightMm}
            onChange={e => setFormData(prev => ({ ...prev, heightMm: e.target.value }))}
          />
        </div>

        <div>
          <label>Timber Species</label>
          <input
            value={formData.timberSpecies}
            onChange={e => setFormData(prev => ({ ...prev, timberSpecies: e.target.value }))}
          />
        </div>

        {/* ... more form fields ... */}

        <button type="submit">Get Estimate</button>
      </form>
    </div>
  );
}

export default QuestionnairePageWithGallery;

/**
 * DYNAMIC TAG FILTERING
 * 
 * You can dynamically filter gallery based on questionnaire progress:
 */

function SmartGalleryIntegration() {
  const [productType, setProductType] = useState("");
  const [location, setLocation] = useState(""); // internal/external

  // Derive tags from questionnaire state
  const galleryTags = [
    location === "external" && "external",
    location === "internal" && "internal",
    // Add more conditional tags
  ].filter(Boolean) as string[];

  return (
    <ExamplePhotoGallery
      tags={galleryTags}
      productType={productType}
      onSelect={(specs) => {
        // Apply specs to form
      }}
    />
  );
}
