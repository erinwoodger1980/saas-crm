// web/src/components/tasks/FormBuilder.tsx
"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import {
  Plus,
  Trash2,
  GripVertical,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  List,
  Mail,
  Phone,
  FileText,
  PenTool,
  Upload,
  MapPin,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "checkbox"
  | "select"
  | "radio"
  | "file"
  | "location"
  | "rating";

type FormField = {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For select/radio
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
};

type FormTemplate = {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  requiresSignature: boolean;
  formSchema: {
    fields: FormField[];
  };
};

const FIELD_TYPES = [
  { type: "text" as FieldType, label: "Text Input", icon: Type },
  { type: "textarea" as FieldType, label: "Text Area", icon: FileText },
  { type: "number" as FieldType, label: "Number", icon: Hash },
  { type: "email" as FieldType, label: "Email", icon: Mail },
  { type: "phone" as FieldType, label: "Phone", icon: Phone },
  { type: "date" as FieldType, label: "Date", icon: Calendar },
  { type: "checkbox" as FieldType, label: "Checkbox", icon: CheckSquare },
  { type: "select" as FieldType, label: "Dropdown", icon: List },
  { type: "radio" as FieldType, label: "Radio Buttons", icon: List },
  { type: "file" as FieldType, label: "File Upload", icon: Upload },
  { type: "location" as FieldType, label: "Location", icon: MapPin },
  { type: "rating" as FieldType, label: "Rating Scale", icon: Star },
];

interface FormBuilderProps {
  existingTemplate?: FormTemplate;
  onSaved?: (template: FormTemplate) => void;
  onCancel?: () => void;
}

export function FormBuilder({ existingTemplate, onSaved, onCancel }: FormBuilderProps) {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";

  const [formName, setFormName] = useState(existingTemplate?.name || "");
  const [formDescription, setFormDescription] = useState(existingTemplate?.description || "");
  const [formCategory, setFormCategory] = useState(existingTemplate?.category || "");
  const [requiresSignature, setRequiresSignature] = useState(
    existingTemplate?.requiresSignature || false
  );
  const [fields, setFields] = useState<FormField[]>(
    existingTemplate?.formSchema?.fields || []
  );

  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [saving, setSaving] = useState(false);

  const generateFieldId = () => `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleAddField = (type: FieldType) => {
    const newField: FormField = {
      id: generateFieldId(),
      type,
      label: `New ${type} field`,
      required: false,
      options: type === "select" || type === "radio" ? ["Option 1", "Option 2"] : undefined,
    };
    setEditingField(newField);
    setShowFieldEditor(true);
  };

  const handleEditField = (field: FormField) => {
    setEditingField(field);
    setShowFieldEditor(true);
  };

  const handleSaveField = () => {
    if (!editingField) return;

    const existingIndex = fields.findIndex((f) => f.id === editingField.id);
    if (existingIndex >= 0) {
      // Update existing field
      const newFields = [...fields];
      newFields[existingIndex] = editingField;
      setFields(newFields);
    } else {
      // Add new field
      setFields([...fields, editingField]);
    }

    setShowFieldEditor(false);
    setEditingField(null);
  };

  const handleDeleteField = (fieldId: string) => {
    setFields(fields.filter((f) => f.id !== fieldId));
  };

  const handleMoveField = (fieldId: string, direction: "up" | "down") => {
    const index = fields.findIndex((f) => f.id === fieldId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === fields.length - 1) return;

    const newFields = [...fields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setFields(newFields);
  };

  const handleSaveTemplate = async () => {
    if (!formName.trim()) {
      alert("Please enter a form name");
      return;
    }

    if (fields.length === 0) {
      alert("Please add at least one field");
      return;
    }

    setSaving(true);
    try {
      const template: FormTemplate = {
        name: formName,
        description: formDescription,
        category: formCategory,
        requiresSignature,
        formSchema: { fields },
      };

      const endpoint = existingTemplate?.id
        ? `/tasks/forms/${existingTemplate.id}`
        : "/tasks/forms";

      const savedTemplate = await apiFetch<FormTemplate>(endpoint, {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "Content-Type": "application/json",
        },
        json: template,
      });

      // Success toast
      const toast = document.createElement("div");
      toast.textContent = "✓ Form template saved";
      toast.className =
        "fixed bottom-6 right-6 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);

      onSaved?.(savedTemplate);
    } catch (error) {
      console.error("Failed to save form template:", error);
      alert("Failed to save form template");
    } finally {
      setSaving(false);
    }
  };

  const renderFieldIcon = (type: FieldType) => {
    const config = FIELD_TYPES.find((ft) => ft.type === type);
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Form Metadata */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Form Details</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="formName">Form Name *</Label>
            <Input
              id="formName"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Safety Inspection Checklist"
            />
          </div>

          <div>
            <Label htmlFor="formDescription">Description</Label>
            <Textarea
              id="formDescription"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Describe the purpose of this form"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="formCategory">Category</Label>
            <Input
              id="formCategory"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              placeholder="e.g., Safety, Quality, HR"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="requiresSignature"
              checked={requiresSignature}
              onCheckedChange={setRequiresSignature}
            />
            <Label htmlFor="requiresSignature">Requires digital signature</Label>
          </div>
        </div>
      </Card>

      {/* Field Palette */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Add Fields</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
            <Button
              key={type}
              variant="outline"
              className="h-auto flex-col gap-2 p-4"
              onClick={() => handleAddField(type)}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </Card>

      {/* Form Preview */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Form Preview</h2>

        {fields.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No fields yet. Add fields using the buttons above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((field, index) => (
              <Card key={field.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1 mt-2">
                    <button
                      onClick={() => handleMoveField(field.id, "up")}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <button
                      onClick={() => handleMoveField(field.id, "down")}
                      disabled={index === fields.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {renderFieldIcon(field.type)}
                      <span className="font-medium">{field.label}</span>
                      {field.required && <span className="text-red-500">*</span>}
                      <span className="text-xs text-gray-500 ml-auto">
                        {FIELD_TYPES.find((ft) => ft.type === field.type)?.label}
                      </span>
                    </div>

                    {/* Field preview */}
                    <div className="mt-2">
                      {(field.type === "text" ||
                        field.type === "email" ||
                        field.type === "phone" ||
                        field.type === "number") && (
                        <Input
                          disabled
                          placeholder={field.placeholder || "Enter value..."}
                          className="bg-gray-50"
                        />
                      )}

                      {field.type === "textarea" && (
                        <Textarea
                          disabled
                          placeholder={field.placeholder || "Enter text..."}
                          rows={3}
                          className="bg-gray-50"
                        />
                      )}

                      {field.type === "date" && (
                        <Input type="date" disabled className="bg-gray-50" />
                      )}

                      {field.type === "checkbox" && (
                        <div className="flex items-center gap-2">
                          <input type="checkbox" disabled className="rounded" />
                          <span className="text-sm text-gray-600">
                            {field.placeholder || "Checkbox option"}
                          </span>
                        </div>
                      )}

                      {field.type === "select" && (
                        <Select disabled>
                          <SelectTrigger className="bg-gray-50">
                            <SelectValue placeholder="Select an option" />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options?.filter(opt => opt && opt.trim()).map((opt, idx) => (
                              <SelectItem key={idx} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {field.type === "radio" && (
                        <div className="space-y-2">
                          {field.options?.map((opt, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                disabled
                                name={field.id}
                                className="rounded-full"
                              />
                              <span className="text-sm text-gray-600">{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditField(field)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteField(field.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {requiresSignature && (
          <Card className="p-4 mt-4 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2">
              <PenTool className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-900">Digital Signature Required</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              Users will be asked to sign this form after filling it out
            </p>
          </Card>
        )}
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSaveTemplate} disabled={saving}>
          {saving ? "Saving..." : "Save Form Template"}
        </Button>
      </div>

      {/* Field Editor Dialog */}
      <Dialog open={showFieldEditor} onOpenChange={setShowFieldEditor}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingField && fields.some((f) => f.id === editingField.id)
                ? "Edit Field"
                : "Add Field"}
            </DialogTitle>
            <DialogDescription>
              Configure the field properties and validation rules
            </DialogDescription>
          </DialogHeader>

          {editingField && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="fieldLabel">Field Label *</Label>
                <Input
                  id="fieldLabel"
                  value={editingField.label}
                  onChange={(e) =>
                    setEditingField({ ...editingField, label: e.target.value })
                  }
                  placeholder="Enter field label"
                />
              </div>

              <div>
                <Label htmlFor="fieldPlaceholder">Placeholder Text</Label>
                <Input
                  id="fieldPlaceholder"
                  value={editingField.placeholder || ""}
                  onChange={(e) =>
                    setEditingField({ ...editingField, placeholder: e.target.value })
                  }
                  placeholder="Optional hint text"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="fieldRequired"
                  checked={editingField.required}
                  onCheckedChange={(checked) =>
                    setEditingField({ ...editingField, required: checked })
                  }
                />
                <Label htmlFor="fieldRequired">Required field</Label>
              </div>

              {(editingField.type === "select" || editingField.type === "radio") && (
                <div>
                  <Label>Options (one per line)</Label>
                  <Textarea
                    value={(editingField.options || []).join("\n")}
                    onChange={(e) =>
                      setEditingField({
                        ...editingField,
                        options: e.target.value.split("\n").filter((o) => o.trim()),
                      })
                    }
                    rows={5}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                  />
                </div>
              )}

              {editingField.type === "number" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minValue">Minimum Value</Label>
                    <Input
                      id="minValue"
                      type="number"
                      value={editingField.validation?.min || ""}
                      onChange={(e) =>
                        setEditingField({
                          ...editingField,
                          validation: {
                            ...editingField.validation,
                            min: e.target.value ? Number(e.target.value) : undefined,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxValue">Maximum Value</Label>
                    <Input
                      id="maxValue"
                      type="number"
                      value={editingField.validation?.max || ""}
                      onChange={(e) =>
                        setEditingField({
                          ...editingField,
                          validation: {
                            ...editingField.validation,
                            max: e.target.value ? Number(e.target.value) : undefined,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFieldEditor(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveField}>Save Field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
