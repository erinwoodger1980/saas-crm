export type SupplierParseResult = {
  currency: string;
  supplier?: string;
  lines: Array<{
    description: string;
    qty?: number;
    unit?: string;
    costUnit?: number;
    sellUnit?: number;
    lineTotal?: number;
    // Image extraction fields
    imageIndex?: number | null;
    imageRef?: string | null;
    imageDataUrl?: string | null;  // base64 thumbnail for PDF rendering
    page?: number;  // page number where line appears
    bbox?: { x: number; y: number; width: number; height: number };  // line bounding box
    meta?: Record<string, any> | null;
  }>;
  detected_totals?: {
    subtotal?: number;
    delivery?: number;
    estimated_total?: number;
  };
  confidence?: number;
  warnings?: string[];
  error?: string;
  usedStages?: Array<"pdfjs" | "ocr" | "llm" | "template">;
  quality?: "ok" | "poor";
  meta?: {
    fallbackCleaner?: boolean;
    rawRows?: number;
    discardedRows?: number;
    fallbackScored?: {
      kept?: number | null;
      discarded?: number | null;
    } | null;
    unmapped_rows?: Array<{
      description?: string;
      score?: number;
      reasons?: string[];
    }>;
    template?: {
      templateId?: string;
      templateName?: string;
      supplierProfileId?: string | null;
      matchedRows?: number;
      annotationCount?: number;
      matchedAnnotations?: number;
      method?: string;
      reason?: string;
    } | null;
    descriptionQuality?: {
      method?: string | null;
      kept?: number | null;
      rejected?: number | null;
      samples?: string[] | null;
    } | null;
  };
  // Extracted images with bounding boxes
  images?: Array<{
    index: number;
    page: number;
    bbox?: { x: number; y: number; width: number; height: number };
    dataUrl?: string;  // base64 encoded image
    width?: number;
    height?: number;
  }>;
};
