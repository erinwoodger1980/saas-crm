// web/src/components/tasks/FormRenderer.tsx
"use client";

import { useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PenTool, Check } from "lucide-react";

type FormField = {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
};

type FormSchema = {
  fields: FormField[];
};

interface FormRendererProps {
  taskId: string;
  formSchema: FormSchema;
  requiresSignature: boolean;
  onSubmitted?: () => void;
  existingData?: Record<string, any>;
  readOnly?: boolean;
}

export function FormRenderer({
  taskId,
  formSchema,
  requiresSignature,
  onSubmitted,
  existingData,
  readOnly = false,
}: FormRendererProps) {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";

  const [formData, setFormData] = useState<Record<string, any>>(existingData || {});
  const [showSignature, setShowSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const validateForm = (): boolean => {
    for (const field of formSchema.fields) {
      if (field.required && !formData[field.id]) {
        alert(`Please fill in: ${field.label}`);
        return false;
      }

      if (field.type === "number" && formData[field.id]) {
        const value = Number(formData[field.id]);
        if (field.validation?.min !== undefined && value < field.validation.min) {
          alert(`${field.label} must be at least ${field.validation.min}`);
          return false;
        }
        if (field.validation?.max !== undefined && value > field.validation.max) {
          alert(`${field.label} must be at most ${field.validation.max}`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (requiresSignature && !showSignature) {
      setShowSignature(true);
      return;
    }

    setSubmitting(true);
    try {
      // Submit form data
      await apiFetch(`/tasks/${taskId}/form-submission`, {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "Content-Type": "application/json",
        },
        json: formData,
      });

      // Submit signature if required
      if (requiresSignature && canvasRef.current) {
        const signatureData = canvasRef.current.toDataURL();
        await apiFetch(`/tasks/${taskId}/signature`, {
          method: "POST",
          headers: {
            "x-tenant-id": tenantId,
            "Content-Type": "application/json",
          },
          json: { signatureData },
        });
      }

      // Success toast
      const toast = document.createElement("div");
      toast.textContent = "✓ Form submitted successfully";
      toast.className =
        "fixed bottom-6 right-6 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);

      onSubmitted?.();
    } catch (error) {
      console.error("Failed to submit form:", error);
      alert("Failed to submit form");
    } finally {
      setSubmitting(false);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id];

    return (
      <div key={field.id} className="space-y-2">
        <Label htmlFor={field.id}>
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>

        {field.type === "text" && (
          <Input
            id={field.id}
            value={value || ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            disabled={readOnly}
            required={field.required}
          />
        )}

        {field.type === "textarea" && (
          <Textarea
            id={field.id}
            value={value || ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            disabled={readOnly}
            required={field.required}
            rows={4}
          />
        )}

        {field.type === "number" && (
          <Input
            id={field.id}
            type="number"
            value={value || ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            disabled={readOnly}
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
          />
        )}

        {field.type === "email" && (
          <Input
            id={field.id}
            type="email"
            value={value || ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            disabled={readOnly}
            required={field.required}
          />
        )}

        {field.type === "phone" && (
          <Input
            id={field.id}
            type="tel"
            value={value || ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            disabled={readOnly}
            required={field.required}
          />
        )}

        {field.type === "date" && (
          <Input
            id={field.id}
            type="date"
            value={value || ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            disabled={readOnly}
            required={field.required}
          />
        )}

        {field.type === "checkbox" && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={value || false}
              onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
              disabled={readOnly}
            />
            <label
              htmlFor={field.id}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {field.placeholder || "Check this box"}
            </label>
          </div>
        )}

        {field.type === "select" && (
          <Select
            value={value || ""}
            onValueChange={(val) => handleFieldChange(field.id, val)}
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || "Select an option"} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {field.type === "radio" && (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={`${field.id}-${option}`}
                  name={field.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  disabled={readOnly}
                  className="rounded-full"
                />
                <label htmlFor={`${field.id}-${option}`} className="text-sm">
                  {option}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (readOnly) {
    return (
      <div className="space-y-4">
        {formSchema.fields.map((field) => (
          <div key={field.id} className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-700 mb-1">{field.label}</div>
            <div className="text-gray-900">
              {formData[field.id] !== undefined && formData[field.id] !== null
                ? String(formData[field.id])
                : <span className="text-gray-400 italic">No response</span>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-6">{formSchema.fields.map(renderField)}</div>
      </Card>

      {requiresSignature && showSignature && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            Digital Signature
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="signatureName">Full Name</Label>
              <Input
                id="signatureName"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>
            <div>
              <Label>Sign below</Label>
              <div className="border-2 border-gray-300 rounded-lg bg-white">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  className="w-full cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={clearSignature}>
                  Clear
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            By signing above, you confirm that the information provided is accurate
          </p>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button onClick={handleSubmit} disabled={submitting} size="lg">
          {submitting ? (
            "Submitting..."
          ) : requiresSignature && !showSignature ? (
            <>
              Continue to Signature
              <PenTool className="h-4 w-4 ml-2" />
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Submit Form
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
