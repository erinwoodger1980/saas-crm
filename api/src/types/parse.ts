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
  usedStages?: Array<"pdfjs" | "ocr" | "llm">;
  quality?: "ok" | "poor";
  meta?: {
    fallbackCleaner?: boolean;
    rawRows?: number;
    discardedRows?: number;
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
