"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import useSWR from "swr";
import InlineEditableCell from "./InlineEditableCell";
import CreateQuestionnaireFieldModal, { NewFieldPayload } from "./CreateQuestionnaireFieldModal";
import { VisualOptionsEditor } from "./VisualOptionsEditor";

export interface QuestionnaireFieldRow {
  id: string;
  label: string;
  type: "text" | "number" | "select" | "boolean" | string; // allow unknown gracefully
  required: boolean;
  costingInputKey?: string | null;
  order: number; // local ordering (maps to backend sortOrder or order)
  options?: string[] | null;
  isStandard?: boolean; // true for built-in fields
  scope?: "client" | "quote_details" | "manufacturing" | "fire_door_schedule" | "fire_door_line_items" | "public" | "internal"; // where field is used
}

const FIELD_TYPES: Array<QuestionnaireFieldRow["type"]> = ["text", "number", "select", "boolean"];
const SCOPE_OPTIONS: Array<NonNullable<QuestionnaireFieldRow["scope"]>> = [
  "client",
  "quote_details",
  "manufacturing",
  "fire_door_schedule",
  "fire_door_line_items",
  "public",
  "internal",
];

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

function SortableRow({ field, onChange, onDelete }: { field: QuestionnaireFieldRow; onChange: (f: Partial<QuestionnaireFieldRow>) => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? "#f8fafc" : undefined,
  };
  const isStandard = field.isStandard;
  const [showOptionsEditor, setShowOptionsEditor] = useState(false);
  
  return (
    <>
      <tr ref={setNodeRef} style={style} className={`text-xs border-b last:border-b-0 ${isStandard ? 'bg-slate-50/50' : ''}`}>
        <td className="w-6 text-slate-400 select-none" {...attributes} {...listeners} title="Drag to reorder">
          ⠿
        </td>
        <td className="min-w-[160px]">
          <InlineEditableCell
            value={field.label}
            onSave={async (next) => onChange({ label: next })}
          />
        </td>
        <td className="w-32">
          <InlineEditableCell
            value={field.type}
            type="select"
            selectOptions={FIELD_TYPES}
            onSave={async (next) => onChange({ type: next })}
          />
        </td>
        <td className="w-28">
          <InlineEditableCell
            value={field.scope || "public"}
            type="select"
            selectOptions={SCOPE_OPTIONS}
            onSave={async (next) => onChange({ scope: next as any })}
          />
        </td>
        <td className="w-20 text-center">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            title="Toggle required"
          />
        </td>
        <td className="min-w-[140px]">
          <InlineEditableCell
            value={field.costingInputKey || ""}
            onSave={async (next) => onChange({ costingInputKey: next || null })}
          />
        </td>
        <td className="w-32">
          {field.type === "select" ? (
            <button
              onClick={() => setShowOptionsEditor(!showOptionsEditor)}
              className="px-3 py-1 rounded text-[11px] bg-blue-50 text-blue-600 hover:bg-blue-100"
              title="Edit options"
            >
              {field.options?.length || 0} options
            </button>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="w-20 text-right pr-2">
          {!isStandard ? (
            <button
              onClick={onDelete}
              className="px-2 py-1 rounded text-[11px] bg-red-50 text-red-600 hover:bg-red-100"
              title="Delete field"
            >
              Delete
            </button>
          ) : (
            <span className="text-[10px] text-slate-400">Standard</span>
          )}
        </td>
      </tr>
      {showOptionsEditor && field.type === "select" && (
        <tr>
          <td colSpan={8} className="p-4 bg-slate-50">
            <div className="max-w-2xl">
              <h4 className="text-sm font-semibold mb-3 text-slate-700">Edit Options for "{field.label}"</h4>
              <VisualOptionsEditor
                options={field.options || []}
                onChange={(newOptions) => {
                  onChange({ options: newOptions });
                  setShowOptionsEditor(false);
                }}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}



export const AdminQuestionnaireFieldsTable: React.FC<{
  apiBase?: string;
  scope?: "client" | "quote_details" | "manufacturing" | "fire_door_schedule" | "fire_door_line_items" | "public" | "internal";
}> = ({ apiBase = process.env.NEXT_PUBLIC_API_URL || "", scope }) => {
  const listUrl = apiBase.replace(/\/$/, "") + "/questionnaire-fields?includeStandard=true" + (scope ? `&scope=${scope}` : "");
  const { data, mutate, isLoading } = useSWR<QuestionnaireFieldRow[]>(listUrl, fetcher);
  const [rows, setRows] = useState<QuestionnaireFieldRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Sync local rows with fetched data
  useEffect(() => {
    if (Array.isArray(data)) {
      // Backend might use sortOrder; normalize to order
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
      })) as QuestionnaireFieldRow[];
      normalized.sort((a, b) => a.order - b.order);
      setRows(normalized);
    }
  }, [data]);

  // Auto-seed standard fields if none exist
  async function seedStandardFields() {
    setSeeding(true);
    try {
      const response = await fetch(listUrl.split('?')[0] + '/seed-standard', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        await mutate();
      }
    } catch (e) {
      console.error('Failed to seed standard fields:', e);
    } finally {
      setSeeding(false);
    }
  }

  async function updateField(id: string, patch: Partial<QuestionnaireFieldRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    try {
      const body: any = { ...patch };
      if (body.type) body.type = String(body.type).toLowerCase();
      // Map local 'order' to expected backend field name
      if (body.order !== undefined) {
        body.sortOrder = body.order;
        delete body.order;
      }
      await fetch(listUrl + "/" + id, {
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
    await fetch(listUrl + "/" + id, { method: "DELETE", credentials: 'include' });
    mutate();
  }

  async function createField(payload: NewFieldPayload) {
    const body = {
      key: payload.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
      label: payload.label.trim(),
      type: payload.type,
      required: payload.required,
      costingInputKey: payload.costingInputKey,
      options: payload.options,
      sortOrder: rows.length ? Math.max(...rows.map((r) => r.order)) + 1 : 0,
      scope: payload.scope || scope || "public",
    };
    try {
      const resp = await fetch(listUrl, {
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
      await fetch(listUrl + "/reorder", {
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

  const content = useMemo(() => {
    if (isLoading || seeding) return <div className="p-4 text-xs text-slate-500">{seeding ? 'Setting up standard fields…' : 'Loading fields…'}</div>;
    if (!rows.length) {
      return (
        <div className="p-4 text-center">
          <div className="text-xs text-slate-500 mb-3">No questionnaire fields found.</div>
          <button
            onClick={seedStandardFields}
            className="rounded bg-blue-600 text-white text-xs px-4 py-2 hover:bg-blue-500"
          >
            Set Up Standard Fields
          </button>
        </div>
      );
    }
    
    const filtered = scope ? rows.filter(r => (r.scope || "public") === scope) : rows;
    const standardFields = filtered.filter(r => r.isStandard);
    const customFields = filtered.filter(r => !r.isStandard);
    
    return (
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {/* Standard Fields Section */}
          {standardFields.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-2 px-1">Standard Fields</h3>
              <div className="rounded border bg-white shadow-sm overflow-hidden">
                <SortableContext items={standardFields.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="w-6"></th>
                        <th className="text-left font-medium py-2 px-2">Label</th>
                        <th className="text-left font-medium">Type</th>
                        <th className="text-left font-medium">Scope</th>
                        <th className="text-center font-medium">Required</th>
                        <th className="text-left font-medium">Costing Key</th>
                        <th className="text-left font-medium">Options</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {standardFields.map((r) => (
                        <SortableRow
                          key={r.id}
                          field={r}
                          onChange={(patch) => updateField(r.id, patch)}
                          onDelete={() => deleteField(r.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </SortableContext>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 px-1">Standard fields can be edited but not deleted. Customize options and settings as needed.</p>
            </div>
          )}
          
          {/* Custom Fields Section */}
          <div>
            <h3 className="text-xs font-semibold text-slate-700 mb-2 px-1">Custom Fields</h3>
            {customFields.length === 0 ? (
              <div className="rounded border bg-white shadow-sm p-4 text-xs text-slate-500">
                No custom fields yet. Click "New Field" to create one.
              </div>
            ) : (
              <div className="rounded border bg-white shadow-sm overflow-hidden">
                <SortableContext items={customFields.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="w-6"></th>
                        <th className="text-left font-medium py-2 px-2">Label</th>
                        <th className="text-left font-medium">Type</th>
                        <th className="text-left font-medium">Scope</th>
                        <th className="text-center font-medium">Required</th>
                        <th className="text-left font-medium">Costing Key</th>
                        <th className="text-left font-medium">Options</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {customFields.map((r) => (
                        <SortableRow
                          key={r.id}
                          field={r}
                          onChange={(patch) => updateField(r.id, patch)}
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
    );
  }, [isLoading, rows]);

  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);

  async function runMigration() {
    if (!confirm("This will sync all standard fields and remove deprecated ones (door_height_mm, door_width_mm, final_width_mm, final_height_mm, installation_date). Continue?")) {
      return;
    }
    setMigrating(true);
    setMigrationResult(null);
    try {
      const response = await fetch(listUrl.split('?')[0] + '/migrate-standard-fields', {
        method: 'POST',
        credentials: 'include',
      });
      const result = await response.json();
      if (response.ok) {
        setMigrationResult(`✅ ${result.message}`);
        await mutate();
      } else {
        setMigrationResult(`❌ Migration failed: ${result.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error('Failed to run migration:', e);
      setMigrationResult(`❌ Migration error: ${e.message}`);
    } finally {
      setMigrating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold">Questionnaire Fields{scope ? ` — ${scope}` : ''}</h1>
        <div className="flex items-center gap-2">
          {savingOrder && <span className="text-[10px] text-slate-400">Saving order…</span>}
          {migrationResult && <span className="text-[10px] px-2 py-1 rounded bg-slate-100">{migrationResult}</span>}
          <button
            type="button"
            onClick={runMigration}
            disabled={migrating}
            className="rounded bg-purple-600 text-white text-xs px-3 py-1 hover:bg-purple-500 disabled:opacity-50"
            title="Sync latest standard fields and remove deprecated ones"
          >
            {migrating ? 'Migrating...' : 'Migrate Fields'}
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded bg-blue-600 text-white text-xs px-3 py-1 hover:bg-blue-500"
          >
            New Field
          </button>
        </div>
      </div>
      {content}
      <CreateQuestionnaireFieldModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={async (payload) => {
          await createField(payload);
        }}
        defaultScope={scope || "public"}
      />
    </div>
  );
};

export default AdminQuestionnaireFieldsTable;
