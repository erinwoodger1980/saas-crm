"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import useSWR from "swr";
import InlineEditableCell from "./InlineEditableCell";
import CreateQuestionnaireFieldModal, { NewFieldPayload } from "./CreateQuestionnaireFieldModal";
import { VisualOptionsEditor } from "./VisualOptionsEditor";
import { ProductTypeSelector } from "./ProductTypeSelector";

export interface QuestionnaireFieldRow {
  id: string;
  label: string;
  type: "text" | "number" | "select" | "boolean" | string;
  required: boolean;
  costingInputKey?: string | null;
  order: number;
  options?: string[] | null;
  isStandard?: boolean;
  scope?: "project_details" | "manufacturing" | "fire_door_schedule" | "fire_door_line_items" | "public";
  productTypes?: string[];
}

const FIELD_TYPES: Array<QuestionnaireFieldRow["type"]> = ["text", "number", "select", "boolean"];
const SCOPE_OPTIONS: Array<NonNullable<QuestionnaireFieldRow["scope"]>> = [
  "project_details",
  "manufacturing",
  "fire_door_schedule",
  "fire_door_line_items",
  "public",
];

const SCOPE_INFO: Record<string, { title: string; description: string; location: string; icon: string }> = {
  "project_details": { title: "Project Details", description: "Lead/quote-specific information & internal tracking", location: "Lead Modal → Project Details Section", icon: "🗂️" },
  "manufacturing": { title: "Manufacturing", description: "Production details (visible after WON)", location: "Lead Modal → Workshop Stage", icon: "🏭" },
  "fire_door_schedule": { title: "Fire Door Schedule", description: "Fire door tracking fields", location: "Fire Door Portal", icon: "🚪" },
  "fire_door_line_items": { title: "Fire Door Line Items", description: "Door specifications & BOM", location: "Fire Door Portal", icon: "📋" },
  "public": { title: "Public Questionnaire", description: "Customer-facing questions", location: "Public Estimator", icon: "🌐" },
};

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

function ScopePreviewBadge({ scope }: { scope: string }) {
  const info = SCOPE_INFO[scope] || { title: scope, description: "", location: "", icon: "❓" };
  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
      <span className="text-lg">{info.icon}</span>
      <div>
        <div className="text-xs font-semibold text-slate-900">{info.title}</div>
        <div className="text-[10px] text-slate-600">{info.location}</div>
      </div>
    </div>
  );
}

function EditFieldModal({ field, isOpen, onClose, onSave }: { field: QuestionnaireFieldRow | null; isOpen: boolean; onClose: () => void; onSave: (updates: Partial<QuestionnaireFieldRow>) => void }) {
  const [edits, setEdits] = useState<Partial<QuestionnaireFieldRow>>({});
  const [showOptions, setShowOptions] = useState(false);
  const [showProductTypes, setShowProductTypes] = useState(false);

  useEffect(() => {
    if (field && isOpen) {
      setEdits({ ...field });
    }
  }, [field, isOpen]);

  if (!field || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Edit Field: {field.label}</h2>
          <p className="text-xs text-slate-500 mt-1">Make changes below. Standard fields cannot be deleted.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Label</label>
            <input
              type="text"
              value={edits.label || ""}
              onChange={(e) => setEdits({ ...edits, label: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
              disabled={field.isStandard}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Type</label>
            <select
              value={edits.type || "text"}
              onChange={(e) => setEdits({ ...edits, type: e.target.value as any })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Scope (Where it appears)</label>
            <select
              value={edits.scope || "public"}
              onChange={(e) => setEdits({ ...edits, scope: e.target.value as any })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
            >
              {SCOPE_OPTIONS.map((s) => (
                <option key={s} value={s}>{SCOPE_INFO[s]?.title || s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Costing Key</label>
            <input
              type="text"
              value={edits.costingInputKey || ""}
              onChange={(e) => setEdits({ ...edits, costingInputKey: e.target.value || null })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
              placeholder="For quote calculations"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={edits.required || false}
              onChange={(e) => setEdits({ ...edits, required: e.target.checked })}
              className="rounded"
            />
            <span className="text-xs font-medium text-slate-700">Required field</span>
          </label>
        </div>

        {/* Preview of where this field will appear */}
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-600 mb-2">This field will appear:</p>
          <ScopePreviewBadge scope={edits.scope || "public"} />
        </div>

        {edits.type === "select" && (
          <div>
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
            >
              {showOptions ? "Hide Options" : "Edit Options"}
            </button>
            {showOptions && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                <VisualOptionsEditor
                  options={edits.options || []}
                  onChange={(newOptions) => {
                    setEdits({ ...edits, options: newOptions });
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div>
          <button
            onClick={() => setShowProductTypes(!showProductTypes)}
            className="text-xs font-semibold text-purple-600 hover:text-purple-700 px-2 py-1 rounded hover:bg-purple-50"
          >
            {showProductTypes ? "Hide Product Type Filter" : "Set Product Type Filter"}
          </button>
          {showProductTypes && (
            <div className="mt-2 p-3 bg-purple-50 rounded-lg">
              <ProductTypeSelector
                selectedProductTypes={edits.productTypes || []}
                onChange={(productTypes) => {
                  setEdits({ ...edits, productTypes: productTypes.length > 0 ? productTypes : undefined });
                }}
                onClose={() => {}}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(edits);
              onClose();
            }}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ field, onEdit, onDelete }: { field: QuestionnaireFieldRow; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? "#f8fafc" : undefined,
  };
  const scopeInfo = SCOPE_INFO[field.scope || "public"] || { title: field.scope || "public", description: "", location: "", icon: "❓" };

  return (
    <tr ref={setNodeRef} style={style} className="border-b hover:bg-slate-50/50 transition-colors">
      <td className="w-6 text-slate-400 select-none cursor-grab active:cursor-grabbing px-3 py-3" {...attributes} {...listeners} title="Drag to reorder">
        ⠿
      </td>
      <td className="py-3 px-2">
        <div>
          <div className="text-sm font-medium text-slate-900">{field.label}</div>
          <div className="text-xs text-slate-500">{field.isStandard ? "Standard field" : "Custom field"}</div>
        </div>
      </td>
      <td className="py-3 px-2">
        <span className="inline-block px-2 py-1 rounded text-xs bg-slate-100 text-slate-700 font-medium">{String(field.type).toLowerCase()}</span>
      </td>
      <td className="py-3 px-2">
        <div className="text-xs">
          <div className="font-medium text-slate-900">{scopeInfo.title}</div>
          <div className="text-slate-500 text-[10px]">{scopeInfo.location}</div>
        </div>
      </td>
      <td className="py-3 px-2 text-center">
        {field.required && <span className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold">Required</span>}
      </td>
      <td className="py-3 px-2 text-right">
        <button
          onClick={onEdit}
          className="px-3 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium"
        >
          Edit
        </button>
        {!field.isStandard && (
          <button
            onClick={onDelete}
            className="ml-1 px-3 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 font-medium"
          >
            Delete
          </button>
        )}
      </td>
    </tr>
  );
}

export const AdminQuestionnaireFieldsTable: React.FC<{
  apiBase?: string;
  scope?: "client" | "quote_details" | "manufacturing" | "fire_door_schedule" | "fire_door_line_items" | "public" | "internal";
}> = ({ apiBase = process.env.NEXT_PUBLIC_API_URL || "", scope }) => {
  const baseUrl = apiBase.replace(/\/$/, "") + "/questionnaire-fields";
  const listUrl = baseUrl + "?includeStandard=true" + (scope ? `&scope=${scope}` : "");
  const { data, mutate, isLoading } = useSWR<QuestionnaireFieldRow[]>(listUrl, fetcher);
  const [rows, setRows] = useState<QuestionnaireFieldRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editingField, setEditingField] = useState<QuestionnaireFieldRow | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    if (Array.isArray(data)) {
      const normalized = data.map((f: any) => ({
        id: f.id,
        label: f.label,
        type: f.type?.toLowerCase?.() || f.type,
        required: !!f.required,
        costingInputKey: f.costingInputKey ?? null,
        order: f.order ?? f.sortOrder ?? 0,
        options: f.options || (Array.isArray(f.config?.options) ? f.config.options : null),
        isStandard: f.isStandard || false,
        scope: f.scope === "item" ? "public" : (f.scope || "public"),
        productTypes: f.productTypes,
      })) as QuestionnaireFieldRow[];
      normalized.sort((a, b) => a.order - b.order);
      setRows(normalized);
    }
  }, [data]);

  async function seedStandardFields() {
    setSeeding(true);
    try {
      const seedUrl = baseUrl + '/seed-standard';
      console.log('[AdminQuestionnaireFieldsTable] Seeding standard fields...', seedUrl);
      console.log('[AdminQuestionnaireFieldsTable] Current scope:', scope);
      
      const response = await fetch(seedUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[AdminQuestionnaireFieldsTable] Seed response status:', response.status, response.statusText);
      
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('[AdminQuestionnaireFieldsTable] Failed to parse response:', parseError);
        alert(`❌ Server returned invalid response (status ${response.status})`);
        setSeeding(false);
        return;
      }
      
      console.log('[AdminQuestionnaireFieldsTable] Seed result:', result);
      
      if (response.ok && result.ok) {
        alert(`✅ Standard fields seeded successfully!\n\nCreated: ${result.fieldsCreated || 0}\nSkipped (already exist): ${result.fieldsSkipped || 0}\n\nQuestionnaire: ${result.questionnaire?.name || 'Unknown'}`);
        await mutate();
      } else {
        console.error('[AdminQuestionnaireFieldsTable] Seed failed:', { status: response.status, result });
        alert(`❌ Failed to seed standard fields:\n\nStatus: ${response.status}\nError: ${result.error || result.detail || JSON.stringify(result)}`);
      }
    } catch (e) {
      console.error('[AdminQuestionnaireFieldsTable] Exception:', e);
      alert(`❌ Error seeding standard fields:\n${(e as Error).message || 'Network error'}`);
    } finally {
      setSeeding(false);
    }
  }

  async function updateField(id: string, patch: Partial<QuestionnaireFieldRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    try {
      const body: any = { ...patch };
      if (body.type) body.type = String(body.type).toUpperCase(); // Convert to UPPERCASE for Prisma enum
      if (body.order !== undefined) {
        body.sortOrder = body.order;
        delete body.order;
      }
      await fetch(baseUrl + "/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      mutate();
    } catch (e) {
      console.error("Failed to update field", e);
    }
  }

  async function deleteField(id: string) {
    if (!confirm("Delete this field?")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    await fetch(baseUrl + "/" + id, { method: "DELETE", credentials: 'include' });
    mutate();
  }

  async function createField(payload: NewFieldPayload) {
    const body = {
      key: payload.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
      label: payload.label.trim(),
      type: payload.type.toUpperCase(), // Convert to UPPERCASE for Prisma enum
      required: payload.required,
      costingInputKey: payload.costingInputKey,
      options: payload.options,
      sortOrder: rows.length ? Math.max(...rows.map((r) => r.order)) + 1 : 0,
      scope: payload.scope || scope || "public",
    };
    try {
      const resp = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        alert("Create failed: " + txt);
      }
      mutate();
    } catch (e: any) {
      alert("Create failed: " + e.message);
    }
  }

  function handleDragEnd(evt: DragEndEvent) {
    const { active, over } = evt;
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.id === active.id);
      const newIndex = prev.findIndex((r) => r.id === over.id);
      const newArr = arrayMove(prev, oldIndex, newIndex).map((r, i) => ({ ...r, order: i }));
      void persistOrder(newArr);
      return newArr;
    });
  }

  async function persistOrder(newRows: QuestionnaireFieldRow[]) {
    setSavingOrder(true);
    try {
      await fetch(baseUrl + "/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ fields: newRows.map((r) => ({ id: r.id, sortOrder: r.order })) }),
      });
      mutate();
    } catch (e) {
      console.error("Reorder failed", e);
    } finally {
      setSavingOrder(false);
    }
  }

  if (isLoading) {
    return <div className="p-4 text-xs text-slate-500">Loading fields…</div>;
  }

  if (!rows.length) {
    return (
      <div className="p-4 text-center">
        <div className="text-sm text-slate-500 mb-3">No questionnaire fields found.</div>
        <button
          onClick={seedStandardFields}
          disabled={seeding}
          className="rounded bg-blue-600 text-white text-sm px-4 py-2 hover:bg-blue-500 disabled:opacity-50"
        >
          {seeding ? 'Setting up…' : 'Set Up Standard Fields'}
        </button>
      </div>
    );
  }

  const filtered = scope ? rows.filter(r => (r.scope || "public") === scope) : rows;
  const standardFields = filtered.filter(r => r.isStandard);
  const customFields = filtered.filter(r => !r.isStandard);

  return (
    <div className="space-y-6">
      {/* Header with Action Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Fields</h2>
          {scope && <p className="text-xs text-slate-500 mt-1">{SCOPE_INFO[scope]?.description || scope}</p>}
        </div>
        <div className="flex items-center gap-2">
          {savingOrder && <span className="text-[10px] text-amber-600">Saving order…</span>}
          <button
            onClick={seedStandardFields}
            disabled={seeding}
            className="rounded bg-emerald-600 text-white text-sm px-4 py-2 hover:bg-emerald-500 disabled:opacity-50 font-medium"
          >
            {seeding ? 'Setting up…' : '🌱 Seed Standard Fields'}
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded bg-blue-600 text-white text-sm px-4 py-2 hover:bg-blue-500 font-medium"
          >
            + New Field
          </button>
        </div>
      </div>

      {/* Scope Info */}
      {scope && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <ScopePreviewBadge scope={scope} />
        </div>
      )}

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {/* Standard Fields */}
          {standardFields.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase text-slate-700 mb-2">Standard Fields</h3>
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <SortableContext items={standardFields.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr className="text-xs font-semibold uppercase text-slate-600">
                        <th className="w-6 px-3 py-2"></th>
                        <th className="text-left px-2 py-2">Label</th>
                        <th className="text-left px-2 py-2">Type</th>
                        <th className="text-left px-2 py-2">Location</th>
                        <th className="text-left px-2 py-2 w-20">Flags</th>
                        <th className="text-right px-2 py-2 w-32">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standardFields.map((r) => (
                        <FieldRow
                          key={r.id}
                          field={r}
                          onEdit={() => {
                            setEditingField(r);
                            setEditModalOpen(true);
                          }}
                          onDelete={() => deleteField(r.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </SortableContext>
              </div>
            </div>
          )}

          {/* Custom Fields */}
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-700 mb-2">Custom Fields</h3>
            {customFields.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-slate-500">No custom fields yet. Click "+ New Field" to create one.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <SortableContext items={customFields.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr className="text-xs font-semibold uppercase text-slate-600">
                        <th className="w-6 px-3 py-2"></th>
                        <th className="text-left px-2 py-2">Label</th>
                        <th className="text-left px-2 py-2">Type</th>
                        <th className="text-left px-2 py-2">Location</th>
                        <th className="text-left px-2 py-2 w-20">Flags</th>
                        <th className="text-right px-2 py-2 w-32">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customFields.map((r) => (
                        <FieldRow
                          key={r.id}
                          field={r}
                          onEdit={() => {
                            setEditingField(r);
                            setEditModalOpen(true);
                          }}
                          onDelete={() => deleteField(r.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </SortableContext>
              </div>
            )}
          </div>
        </div>
      </DndContext>

      {/* Modals */}
      <CreateQuestionnaireFieldModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={async (payload) => {
          await createField(payload);
          setCreating(false);
        }}
        defaultScope={scope || "public"}
      />

      <EditFieldModal
        field={editingField}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={(updates) => {
          if (editingField) {
            updateField(editingField.id, updates);
          }
        }}
      />
    </div>
  );
};

export default AdminQuestionnaireFieldsTable;
