// src/components/questionnaire/QuestionnaireFieldEditor.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Plus, GripVertical, Trash2, Save, X, Settings } from "lucide-react";

interface QuestionnaireField {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  config?: any;
  sortOrder: number;
  isActive: boolean;
  costingInputKey?: string;
}

interface FieldFormData {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string;
  helpText: string;
  config: any;
  costingInputKey: string;
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
  { value: "boolean", label: "Yes/No" },
  { value: "textarea", label: "Long Text" },
  { value: "date", label: "Date" },
];

export default function QuestionnaireFieldEditor() {
  const [fields, setFields] = useState<QuestionnaireField[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FieldFormData>({
    key: "",
    label: "",
    type: "text",
    required: false,
    placeholder: "",
    helpText: "",
    config: null,
    costingInputKey: "",
  });
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    fetchFields();
  }, []);

  async function fetchFields() {
    try {
      setLoading(true);
      const res = await fetch("/api/questionnaire-fields");
      if (!res.ok) throw new Error("Failed to fetch fields");
      const data = await res.json();
      setFields(data);
    } catch (_err) {
      console.error("Failed to fetch fields:", _err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      const payload = {
        ...formData,
        config: formData.type === "select" && formData.config ? formData.config : null,
      };

      const url = editingId
        ? `/api/questionnaire-fields/${editingId}`
        : "/api/questionnaire-fields";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }

      await fetchFields();
      resetForm();
    } catch (err: any) {
      alert(err.message || "Failed to save field");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this field? This will remove all associated answers.")) return;

    try {
      const res = await fetch(`/api/questionnaire-fields/${id}?hard=true`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      await fetchFields();
    } catch (_err) {
      alert("Failed to delete field");
    }
  }

  function handleEdit(field: QuestionnaireField) {
    setEditingId(field.id);
    setFormData({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder || "",
      helpText: field.helpText || "",
      config: field.config || null,
      costingInputKey: field.costingInputKey || "",
    });
    setShowNewForm(true);
  }

  function resetForm() {
    setEditingId(null);
    setFormData({
      key: "",
      label: "",
      type: "text",
      required: false,
      placeholder: "",
      helpText: "",
      config: null,
      costingInputKey: "",
    });
    setShowNewForm(false);
  }

  // Disabled drag-and-drop reorder for now
  // async function handleReorder(dragIndex: number, dropIndex: number) {
  //   const reordered = [...fields];
  //   const [moved] = reordered.splice(dragIndex, 1);
  //   reordered.splice(dropIndex, 0, moved);

  //   const updates = reordered.map((f, idx) => ({ id: f.id, sortOrder: idx }));
  //   setFields(reordered);

  //   try {
  //     await fetch("/api/questionnaire-fields/reorder", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ fields: updates }),
  //     });
  //   } catch (err) {
  //     console.error("Failed to reorder:", err);
  //     await fetchFields();
  //   }
  // }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-gray-500">Loading fields...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Quote Form Fields</h2>
          <p className="text-sm text-gray-600 mt-1">
            Define custom fields for your quote forms. Map fields to costing inputs for automated pricing.
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Field
        </button>
      </div>

      {showNewForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingId ? "Edit Field" : "New Field"}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="e.g., door_height"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={!!editingId}
              />
              <p className="text-xs text-gray-500 mt-1">Unique identifier (no spaces)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Label <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., Door Height (mm)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Costing Input Key
              </label>
              <input
                type="text"
                value={formData.costingInputKey}
                onChange={(e) => setFormData({ ...formData, costingInputKey: e.target.value })}
                placeholder="e.g., door_height_mm"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Map to costing engine input</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
              <input
                type="text"
                value={formData.placeholder}
                onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                placeholder="e.g., Enter height in mm"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Help Text</label>
              <input
                type="text"
                value={formData.helpText}
                onChange={(e) => setFormData({ ...formData, helpText: e.target.value })}
                placeholder="Additional guidance for users"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {formData.type === "select" && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Options (JSON)
                </label>
                <textarea
                  value={
                    formData.config
                      ? JSON.stringify(formData.config, null, 2)
                      : '{"options": ["Option 1", "Option 2"]}'
                  }
                  onChange={(e) => {
                    try {
                      setFormData({ ...formData, config: JSON.parse(e.target.value) });
                    } catch {}
                  }}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            )}

            <div className="col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.required}
                  onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Required field</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              {editingId ? "Update" : "Create"}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {fields.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No fields defined yet. Add your first field to get started.</p>
          </div>
        ) : (
          fields.map((field) => (
            <div
              key={field.id}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <button
                className="cursor-move text-gray-400 hover:text-gray-600"
                onMouseDown={() => {}}
              >
                <GripVertical className="w-5 h-5" />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{field.label}</span>
                  <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                    {field.type}
                  </span>
                  {field.required && (
                    <span className="text-xs text-red-600 px-2 py-1 bg-red-50 rounded">
                      Required
                    </span>
                  )}
                  {field.costingInputKey && (
                    <span className="text-xs text-blue-600 px-2 py-1 bg-blue-50 rounded">
                      Costing: {field.costingInputKey}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Key: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{field.key}</code>
                  {field.placeholder && <> • Placeholder: &quot;{field.placeholder}&quot;</>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(field)}
                  className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(field.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
