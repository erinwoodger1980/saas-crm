"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SupplierOption = { id: string; name: string | null };

export type MaterialFormData = {
  name: string;
  code: string;
  category: string;
  supplierId?: string | null;
  description?: string | null;
  cost: number;
  currency: string;
  unit: string;
  stockQuantity?: number | null;
  minStockLevel?: number | null;
  leadTimeDays?: number | null;
  isActive: boolean;
  notes?: string | null;
};

type FormValues = {
  name: string;
  code: string;
  category: string;
  supplierId: string;
  description: string;
  cost: string;
  currency: string;
  unit: string;
  stockQuantity: string;
  minStockLevel: string;
  leadTimeDays: string;
  isActive: boolean;
  notes: string;
};

type MaterialFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initialData?: Partial<MaterialFormData> | null;
  categories: string[];
  suppliers: SupplierOption[];
  onOpenChange(_open: boolean): void;
  onSubmit(_values: MaterialFormData): Promise<void>;
};

const DEFAULT_CURRENCIES = ["GBP", "EUR", "USD"];

export function MaterialFormDialog({
  open,
  mode,
  initialData,
  categories,
  suppliers,
  onOpenChange,
  onSubmit,
}: MaterialFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaults = useMemo<FormValues>(() => ({
    name: initialData?.name ?? "",
    code: initialData?.code ?? "",
    category: initialData?.category ?? categories[0] ?? "",
    supplierId: initialData?.supplierId ?? "",
    description: initialData?.description ?? "",
    cost: initialData?.cost != null ? String(initialData.cost) : "",
    currency: initialData?.currency ?? "GBP",
    unit: initialData?.unit ?? "each",
    stockQuantity: initialData?.stockQuantity != null ? String(initialData.stockQuantity) : "",
    minStockLevel: initialData?.minStockLevel != null ? String(initialData.minStockLevel) : "",
    leadTimeDays: initialData?.leadTimeDays != null ? String(initialData.leadTimeDays) : "",
    isActive: initialData?.isActive ?? true,
    notes: initialData?.notes ?? "",
  }), [initialData, categories]);

  const currencyOptions = useMemo(() => {
    const set = new Set(DEFAULT_CURRENCIES);
    if (initialData?.currency) set.add(initialData.currency);
    return Array.from(set);
  }, [initialData]);

  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) {
      reset(defaults);
    }
  }, [defaults, open, reset]);

  const categoryOptions = categories.length > 0 ? categories : [defaults.category].filter(Boolean);

  const submitHandler = handleSubmit(async (values) => {
    setIsSubmitting(true);
    const payload: MaterialFormData = {
      name: values.name.trim(),
      code: values.code.trim(),
      category: values.category,
      supplierId: values.supplierId ? values.supplierId : null,
      description: values.description?.trim() || null,
      cost: Number(values.cost || 0),
      currency: values.currency || "GBP",
      unit: values.unit || "each",
      stockQuantity: values.stockQuantity ? Number(values.stockQuantity) : null,
      minStockLevel: values.minStockLevel ? Number(values.minStockLevel) : null,
      leadTimeDays: values.leadTimeDays ? Number(values.leadTimeDays) : null,
      isActive: values.isActive,
      notes: values.notes?.trim() || null,
    };
    try {
      await onSubmit(payload);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Material" : "Edit Material"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Track supplier pricing, lead times, and stock in one place."
              : "Update supplier pricing details and availability."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitHandler} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Accoya 44mm blank" {...register("name", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">SKU / Code</Label>
              <Input id="code" placeholder="MAT-001" {...register("code", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={watch("category") || ""} onValueChange={(val) => setValue("category", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={watch("supplierId") || ""} onValueChange={(val) => setValue("supplierId", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name || "Unnamed supplier"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost</Label>
              <Input id="cost" type="number" step="0.01" min="0" placeholder="0.00" {...register("cost", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={watch("currency") || "GBP"} onValueChange={(val) => setValue("currency", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="GBP" />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((cur) => (
                    <SelectItem key={cur} value={cur}>
                      {cur}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" placeholder="each" {...register("unit", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stockQuantity">Stock on Hand</Label>
              <Input id="stockQuantity" type="number" step="0.01" {...register("stockQuantity")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStockLevel">Min Stock Level</Label>
              <Input id="minStockLevel" type="number" step="0.01" {...register("minStockLevel")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leadTimeDays">Lead Time (days)</Label>
              <Input id="leadTimeDays" type="number" step="1" min="0" {...register("leadTimeDays")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="isActive">Status</Label>
              <div className="flex h-10 items-center rounded-md border px-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    id="isActive"
                    type="checkbox"
                    className="h-4 w-4 rounded border"
                    checked={watch("isActive")}
                    onChange={(event) => setValue("isActive", event.target.checked)}
                  />
                  Active material
                </label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="description">Internal Description</Label>
              <Textarea id="description" rows={4} placeholder="Notes your estimators need for quoting" {...register("description")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Purchasing Notes</Label>
              <Textarea id="notes" rows={4} placeholder="Preferred supplier terms, rebates, MOQ, etc." {...register("notes")} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : mode === "create" ? "Add Material" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
