export type SupplierParseResult = {
  currency: "GBP" | "EUR" | "USD" | string;
  supplier?: string;
  lines: Array<{
    description: string;
    qty?: number;
    unit?: string;
    costUnit?: number;
    sellUnit?: number;
    lineTotal?: number;
  }>;
  detected_totals?: {
    subtotal?: number;
    delivery?: number;
    estimated_total?: number;
  };
  confidence?: number;
  warnings?: string[];
  error?: string;
};
