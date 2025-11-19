/**
 * PDF Trainer Page
 * 
 * Admin UI for creating annotation templates for supplier PDFs
 * Allows drawing labeled boxes on PDF pages to define layout patterns
 * These templates are used by the backend parser for reliable extraction
 */

'use client';

import dynamic from 'next/dynamic';

// Dynamically import the client component to avoid SSR issues with DOMMatrix and PDF.js
const PdfTrainerClient = dynamic(
  () => import('./PdfTrainerClient').then((mod) => ({ default: mod.PdfTrainerClient })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading PDF Trainer...</p>
        </div>
      </div>
    ),
  }
);

export default function PdfTrainerPage() {
  return <PdfTrainerClient />;
}
