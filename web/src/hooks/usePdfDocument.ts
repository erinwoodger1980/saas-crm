/**
 * usePdfDocument Hook
 * 
 * Handles PDF.js document loading, page rendering, and navigation
 * Returns methods to render pages to canvas and navigate between pages
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// Configure PDF.js worker to use locally hosted worker for reliability.
// Falls back to CDN if local asset missing.
if (typeof window !== 'undefined') {
  const localWorker = '/pdf.worker.min.mjs';
  // Simple existence check via fetch; if it fails, revert to CDN.
  fetch(localWorker, { method: 'HEAD' })
    .then(res => {
      if (res.ok) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = localWorker;
      } else {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        console.warn('[usePdfDocument] Local PDF worker not found, using CDN fallback.');
      }
    })
    .catch(() => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      console.warn('[usePdfDocument] Failed to load local PDF worker, using CDN fallback.');
    });
}

export interface PdfPageInfo {
  pageNumber: number;
  width: number;
  height: number;
}

export interface UsePdfDocumentReturn {
  document: PDFDocumentProxy | null;
  currentPage: number;
  totalPages: number;
  pageInfo: PdfPageInfo | null;
  isLoading: boolean;
  error: string | null;
  setCurrentPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  renderToCanvas: (canvas: HTMLCanvasElement, scale?: number) => Promise<void>;
  getPageDimensions: (pageNum: number) => Promise<{ width: number; height: number } | null>;
}

export function usePdfDocument(file: File | null): UsePdfDocumentReturn {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [pageInfo, setPageInfo] = useState<PdfPageInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const currentPageRef = useRef<PDFPageProxy | null>(null);

  // Load PDF document when file changes
  useEffect(() => {
    if (!file) {
      setDocument(null);
      setTotalPages(0);
      setCurrentPage(1);
      setPageInfo(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDocument = await loadingTask.promise;

        setDocument(pdfDocument);
        setTotalPages(pdfDocument.numPages);
        setCurrentPage(1);
        setIsLoading(false);
      } catch (err: any) {
        console.error('[usePdfDocument] Failed to load PDF:', err);
        setError(err?.message || 'Failed to load PDF');
        setIsLoading(false);
      }
    };

    loadPdf();

    // Cleanup
    return () => {
      if (currentPageRef.current) {
        currentPageRef.current.cleanup();
        currentPageRef.current = null;
      }
    };
  }, [file]);

  // Load current page when page number changes
  useEffect(() => {
    if (!document || currentPage < 1 || currentPage > totalPages) {
      return;
    }

    const loadPage = async () => {
      try {
        // Cleanup previous page
        if (currentPageRef.current) {
          currentPageRef.current.cleanup();
        }

        // Load new page
        const page = await document.getPage(currentPage);
        currentPageRef.current = page;

        const viewport = page.getViewport({ scale: 1.0 });
        setPageInfo({
          pageNumber: currentPage,
          width: viewport.width,
          height: viewport.height,
        });
      } catch (err: any) {
        console.error('[usePdfDocument] Failed to load page:', err);
        setError(err?.message || 'Failed to load page');
      }
    };

    loadPage();
  }, [document, currentPage, totalPages]);

  // Navigation functions
  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);

  // Render page to canvas
  const renderToCanvas = useCallback(
    async (canvas: HTMLCanvasElement, scale: number = 1.5) => {
      if (!currentPageRef.current) {
        console.warn('[usePdfDocument] No page loaded');
        return;
      }

      try {
        const page = currentPageRef.current;
        const viewport = page.getViewport({ scale });

        // Set canvas dimensions
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Failed to get canvas context');
        }

        // Render page
        const renderContext = {
          canvasContext: context,
          viewport,
          canvas,
        } as any; // include canvas to satisfy RenderParameters type & suppress TS complaints for pdf.js version

        await page.render(renderContext).promise;
      } catch (err: any) {
        console.error('[usePdfDocument] Failed to render page:', err);
        throw err;
      }
    },
    []
  );

  // Get dimensions for any page
  const getPageDimensions = useCallback(
    async (pageNum: number): Promise<{ width: number; height: number } | null> => {
      if (!document || pageNum < 1 || pageNum > totalPages) {
        return null;
      }

      try {
        const page = await document.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        return { width: viewport.width, height: viewport.height };
      } catch (err: any) {
        console.error('[usePdfDocument] Failed to get page dimensions:', err);
        return null;
      }
    },
    [document, totalPages]
  );

  return {
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
  };
}
