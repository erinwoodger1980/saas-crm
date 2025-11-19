/**
 * PDF Annotation Types
 * 
 * Defines the structure for annotation boxes drawn on PDF pages
 * These annotations are saved as layout templates for supplier profiles
 */

export type AnnotationLabel =
  | 'joinery_image'
  | 'description'
  | 'qty'
  | 'unit_cost'
  | 'line_total'
  | 'delivery_row'
  | 'header_logo'
  | 'ignore';

export interface AnnotationBox {
  id: string;
  page: number;
  x: number; // relative [0,1] coordinate from left
  y: number; // relative [0,1] from top
  width: number; // relative [0,1]
  height: number; // relative [0,1]
  label: AnnotationLabel;
  rowId?: string; // used to group multiple boxes into one line item
}

export interface PdfLayoutTemplate {
  supplierProfile: string;
  pdfMeta: {
    pageCount: number;
    pageSizes: Array<{ width: number; height: number }>;
  };
  annotations: AnnotationBox[];
}

// Color mapping for visual distinction
export const LABEL_COLORS: Record<AnnotationLabel, string> = {
  joinery_image: 'rgba(59, 130, 246, 0.3)', // blue
  description: 'rgba(16, 185, 129, 0.3)', // green
  qty: 'rgba(245, 158, 11, 0.3)', // amber
  unit_cost: 'rgba(139, 92, 246, 0.3)', // purple
  line_total: 'rgba(236, 72, 153, 0.3)', // pink
  delivery_row: 'rgba(251, 146, 60, 0.3)', // orange
  header_logo: 'rgba(239, 68, 68, 0.3)', // red
  ignore: 'rgba(156, 163, 175, 0.3)', // gray
};

export const LABEL_BORDER_COLORS: Record<AnnotationLabel, string> = {
  joinery_image: 'rgb(59, 130, 246)', // blue-500
  description: 'rgb(16, 185, 129)', // emerald-500
  qty: 'rgb(245, 158, 11)', // amber-500
  unit_cost: 'rgb(139, 92, 246)', // purple-500
  line_total: 'rgb(236, 72, 153)', // pink-500
  delivery_row: 'rgb(251, 146, 60)', // orange-500
  header_logo: 'rgb(239, 68, 68)', // red-500
  ignore: 'rgb(156, 163, 175)', // gray-400
};

export const LABEL_DISPLAY_NAMES: Record<AnnotationLabel, string> = {
  joinery_image: 'Joinery Image',
  description: 'Description',
  qty: 'Quantity',
  unit_cost: 'Unit Cost',
  line_total: 'Line Total',
  delivery_row: 'Delivery Row',
  header_logo: 'Header Logo',
  ignore: 'Ignore',
};
