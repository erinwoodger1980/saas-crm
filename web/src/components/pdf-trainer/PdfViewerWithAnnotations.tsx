/**
 * PdfViewerWithAnnotations Component
 * 
 * Renders PDF page on canvas with draggable annotation boxes overlay
 * Handles mouse interactions for creating and selecting boxes
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { AnnotationBox, AnnotationLabel } from '@/types/pdfAnnotations';
import {
  LABEL_COLORS,
  LABEL_BORDER_COLORS,
  LABEL_DISPLAY_NAMES,
} from '@/types/pdfAnnotations';
import { AnnotationBoxEditor } from './AnnotationBoxEditor';

interface PdfViewerWithAnnotationsProps {
  pageWidth: number;
  pageHeight: number;
  annotations: AnnotationBox[];
  onRenderCanvas: (canvas: HTMLCanvasElement) => Promise<void>;
  onAnnotationsChange: (annotations: AnnotationBox[]) => void;
  scale?: number;
}

interface DrawingState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface EditorState {
  boxId: string;
  position: { x: number; y: number };
  isNew: boolean;
}

export function PdfViewerWithAnnotations({
  pageWidth,
  pageHeight,
  annotations,
  onRenderCanvas,
  onAnnotationsChange,
  scale = 1.5,
}: PdfViewerWithAnnotationsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Scaled dimensions for rendering
  const scaledWidth = pageWidth * scale;
  const scaledHeight = pageHeight * scale;

  // Render PDF to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    onRenderCanvas(canvas).catch((err) => {
      console.error('[PdfViewerWithAnnotations] Failed to render:', err);
    });
  }, [onRenderCanvas]);

  // Convert screen coordinates to relative [0,1] coordinates
  const screenToRelative = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      const overlay = overlayRef.current;
      if (!overlay) return { x: 0, y: 0 };

      const rect = overlay.getBoundingClientRect();
      const relX = (screenX - rect.left) / rect.width;
      const relY = (screenY - rect.top) / rect.height;

      return {
        x: Math.max(0, Math.min(1, relX)),
        y: Math.max(0, Math.min(1, relY)),
      };
    },
    []
  );

  // Mouse handlers for drawing boxes
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only start drawing if clicking on empty space (not on existing box)
    if ((e.target as HTMLElement).dataset.boxId) {
      return;
    }

    const { x, y } = screenToRelative(e.clientX, e.clientY);
    setDrawingState({
      isDrawing: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });
    setEditorState(null); // Close editor if open
    setSelectedBoxId(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawingState.isDrawing) return;

    const { x, y } = screenToRelative(e.clientX, e.clientY);
    setDrawingState((prev) => ({
      ...prev,
      currentX: x,
      currentY: y,
    }));
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawingState.isDrawing) return;

    const { x, y } = screenToRelative(e.clientX, e.clientY);

    // Calculate box dimensions
    const minX = Math.min(drawingState.startX, x);
    const minY = Math.min(drawingState.startY, y);
    const maxX = Math.max(drawingState.startX, x);
    const maxY = Math.max(drawingState.startY, y);
    const width = maxX - minX;
    const height = maxY - minY;

    // Only create box if it has meaningful size
    if (width > 0.01 && height > 0.01) {
      const newBox: AnnotationBox = {
        id: `box-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        page: 1, // Will be set by parent component
        x: minX,
        y: minY,
        width,
        height,
        label: 'description', // Default label
      };

      onAnnotationsChange([...annotations, newBox]);

      // Open editor for new box
      setEditorState({
        boxId: newBox.id,
        position: { x: e.clientX + 10, y: e.clientY + 10 },
        isNew: true,
      });
      setSelectedBoxId(newBox.id);
    }

    setDrawingState({
      isDrawing: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    });
  };

  // Handle box click
  const handleBoxClick = (boxId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBoxId(boxId);
    setEditorState({
      boxId,
      position: { x: e.clientX + 10, y: e.clientY + 10 },
      isNew: false,
    });
  };

  // Editor handlers
  const handleEditorSave = (label: AnnotationLabel, rowId?: string) => {
    if (!editorState) return;

    const updatedAnnotations = annotations.map((box) =>
      box.id === editorState.boxId ? { ...box, label, rowId } : box
    );
    onAnnotationsChange(updatedAnnotations);
    setEditorState(null);
  };

  const handleEditorDelete = () => {
    if (!editorState) return;

    const updatedAnnotations = annotations.filter(
      (box) => box.id !== editorState.boxId
    );
    onAnnotationsChange(updatedAnnotations);
    setEditorState(null);
    setSelectedBoxId(null);
  };

  const handleEditorCancel = () => {
    // If this was a new box that wasn't saved, delete it
    if (editorState?.isNew) {
      const updatedAnnotations = annotations.filter(
        (box) => box.id !== editorState.boxId
      );
      onAnnotationsChange(updatedAnnotations);
    }
    setEditorState(null);
    setSelectedBoxId(null);
  };

  // Render rubber band during drawing
  const renderRubberBand = () => {
    if (!drawingState.isDrawing) return null;

    const minX = Math.min(drawingState.startX, drawingState.currentX);
    const minY = Math.min(drawingState.startY, drawingState.currentY);
    const width = Math.abs(drawingState.currentX - drawingState.startX);
    const height = Math.abs(drawingState.currentY - drawingState.startY);

    return (
      <div
        className="absolute border-2 border-blue-500 border-dashed bg-blue-500/10 pointer-events-none"
        style={{
          left: `${minX * 100}%`,
          top: `${minY * 100}%`,
          width: `${width * 100}%`,
          height: `${height * 100}%`,
        }}
      />
    );
  };

  return (
    <div className="flex items-center justify-center bg-gray-100 p-8 rounded-lg">
      <div className="relative bg-white shadow-lg">
        {/* Canvas for PDF rendering */}
        <canvas
          ref={canvasRef}
          className="block"
          style={{
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
          }}
        />

        {/* Annotation overlay */}
        <div
          ref={overlayRef}
          className="absolute inset-0 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
          }}
        >
          {/* Render existing annotation boxes */}
          {annotations.map((box) => (
            <div
              key={box.id}
              data-box-id={box.id}
              className={`absolute cursor-pointer border-2 transition-all ${
                selectedBoxId === box.id ? 'ring-2 ring-offset-2 ring-blue-500' : ''
              }`}
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`,
                backgroundColor: LABEL_COLORS[box.label],
                borderColor: LABEL_BORDER_COLORS[box.label],
              }}
              onClick={(e) => handleBoxClick(box.id, e)}
              title={`${LABEL_DISPLAY_NAMES[box.label]}${box.rowId ? ` (Row: ${box.rowId})` : ''}`}
            >
              {/* Label badge */}
              <div
                className="absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium text-white rounded"
                style={{
                  backgroundColor: LABEL_BORDER_COLORS[box.label],
                }}
              >
                {LABEL_DISPLAY_NAMES[box.label]}
                {box.rowId && ` #${box.rowId}`}
              </div>
            </div>
          ))}

          {/* Rubber band for drawing */}
          {renderRubberBand()}
        </div>

        {/* Box editor popover */}
        {editorState && (
          <AnnotationBoxEditor
            boxId={editorState.boxId}
            initialLabel={
              annotations.find((b) => b.id === editorState.boxId)?.label
            }
            initialRowId={
              annotations.find((b) => b.id === editorState.boxId)?.rowId
            }
            position={editorState.position}
            onSave={handleEditorSave}
            onDelete={handleEditorDelete}
            onCancel={handleEditorCancel}
          />
        )}
      </div>
    </div>
  );
}
