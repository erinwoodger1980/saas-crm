"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

type ProductOption = {
  id: string;
  label: string;
  imagePath?: string;
  imageDataUrl?: string;
  svg?: string;
  // New per-product-type unified config
  configQuestions?: Array<
    | {
        source: "legacy";
        fieldKey: string;
        label?: string;
        required?: boolean;
      }
    | {
        source: "componentAttribute";
        componentType: string;
        attributeName: string;
        label?: string;
        required?: boolean;
      }
  >;
};

type ProductType = {
  type: string;
  label: string;
  options: ProductOption[];
};

type ProductCategory = {
  id: string;
  label: string;
  types: ProductType[];
};

type QuestionnaireField = {
  id?: string;
  key: string;
  label: string;
  type: string;
};

type ComponentAttribute = {
  id: string;
  componentType: string;
  attributeName: string;
  attributeType: string;
  displayOrder: number;
  isRequired: boolean;
};

export default function ProductConfigurationSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireField[]>([]);
  const [componentTypes, setComponentTypes] = useState<string[]>([]);
  const [attributesByType, setAttributesByType] = useState<Record<string, ComponentAttribute[]>>({});

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedTypeIdx, setSelectedTypeIdx] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Fetch product types from settings
        const settings = await apiFetch<{ productTypes?: ProductCategory[] }>(
          "/tenant/settings"
        );
        const cats = Array.isArray(settings.productTypes) ? settings.productTypes : [];
        setCategories(cats);

        // Fetch questions from Questions API (unified source of truth)
        const questionsData = await apiFetch<any[]>("/questions?isActive=true");
        const normalizedQ = (Array.isArray(questionsData) ? questionsData : [])
          .map((f: any) => ({ key: String(f.label || "").trim(), label: String(f.label || ""), type: String(f.controlType || "input") }))
          .filter((f: QuestionnaireField) => !!f.key);
        setQuestionnaire(normalizedQ);

        const types = await apiFetch<string[]>("/components/types/all");
        setComponentTypes(Array.isArray(types) ? types : []);
      } catch (e: any) {
        toast({ title: "Failed to load configuration", description: e?.message || "", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  // Load attributes lazily when a component type is focused/selected
  async function ensureAttributesLoaded(componentType: string) {
    if (!componentType || attributesByType[componentType]) return;
    try {
      const list = await apiFetch<ComponentAttribute[]>(`/component-attributes?componentType=${encodeURIComponent(componentType)}`);
      setAttributesByType((prev) => ({ ...prev, [componentType]: Array.isArray(list) ? list : [] }));
    } catch (e) {
      // Swallow errors — can still configure legacy fields
      setAttributesByType((prev) => ({ ...prev, [componentType]: [] }));
    }
  }

  const allOptionsFlat = useMemo(() => {
    const out: Array<{ categoryId: string; typeIdx: number; option: ProductOption; pathLabel: string }> = [];
    categories.forEach((cat) => {
      cat.types.forEach((t, idx) => {
        t.options.forEach((opt) => {
          out.push({ categoryId: cat.id, typeIdx: idx, option: opt, pathLabel: `${cat.label} › ${t.label} › ${opt.label}` });
        });
      });
    });
    return out;
  }, [categories]);

  // Initialize a selection when data loads
  useEffect(() => {
    if (allOptionsFlat.length && !selectedOptionId) {
      const first = allOptionsFlat[0];
      setSelectedCategoryId(first.categoryId);
      setSelectedTypeIdx(first.typeIdx);
      setSelectedOptionId(first.option.id);
    }
  }, [allOptionsFlat, selectedOptionId]);

  const selectedOption = useMemo(() => {
    if (!selectedCategoryId) return null;
    const cat = categories.find((c) => c.id === selectedCategoryId);
    if (!cat) return null;
    const type = cat.types[selectedTypeIdx];
    if (!type) return null;
    const opt = type.options.find((o) => o.id === selectedOptionId);
    return opt || null;
  }, [categories, selectedCategoryId, selectedTypeIdx, selectedOptionId]);

  function updateSelectedOption(patch: Partial<ProductOption>) {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id !== selectedCategoryId
          ? cat
          : {
              ...cat,
              types: cat.types.map((t, idx) =>
                idx !== selectedTypeIdx
                  ? t
                  : {
                      ...t,
                      options: t.options.map((o) => (o.id === selectedOptionId ? { ...o, ...patch } : o)),
                    }
              ),
            }
      )
    );
  }

  async function saveConfiguration() {
    setSaving(true);
    try {
      await apiFetch("/tenant/settings", { method: "PATCH", json: { productTypes: categories } });
      toast({ title: "Product configuration saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function addLegacyField(fieldKey: string) {
    if (!fieldKey || !selectedOption) return;
    const label = questionnaire.find((f) => f.key === fieldKey)?.label || fieldKey;
    const next = [...(selectedOption.configQuestions || []), { source: "legacy" as const, fieldKey, label, required: false }];
    updateSelectedOption({ configQuestions: next });
  }

  function addComponentAttribute(componentType: string, attributeName: string) {
    if (!componentType || !attributeName || !selectedOption) return;
    const next = [
      ...(selectedOption.configQuestions || []),
      { source: "componentAttribute" as const, componentType, attributeName, label: attributeName, required: false },
    ];
    updateSelectedOption({ configQuestions: next });
  }

  function removeQuestion(idx: number) {
    if (!selectedOption) return;
    const next = (selectedOption.configQuestions || []).filter((_, i) => i !== idx);
    updateSelectedOption({ configQuestions: next });
  }

  function toggleRequired(idx: number, required: boolean) {
    if (!selectedOption) return;
    const next = (selectedOption.configQuestions || []).map((q, i) => (i === idx ? { ...q, required } : q));
    updateSelectedOption({ configQuestions: next });
  }

  function updateLabel(idx: number, label: string) {
    if (!selectedOption) return;
    const next = (selectedOption.configQuestions || []).map((q, i) => (i === idx ? { ...q, label } : q));
    updateSelectedOption({ configQuestions: next });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600">
          Link product types to questions. Combine legacy fields and component attributes in one flow.
        </p>
        <Button onClick={saveConfiguration} disabled={saving || loading}>{saving ? "Saving..." : "Save Configuration"}</Button>
      </div>

      {/* Select product option */}
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <label className="block text-xs font-semibold text-slate-600 mb-1">Select Product Type/Option</label>
        <select
          className="w-full rounded-md border p-2 text-sm"
          value={selectedOptionId}
          onChange={(e) => {
            const id = e.target.value;
            const found = allOptionsFlat.find((o) => o.option.id === id);
            if (found) {
              setSelectedCategoryId(found.categoryId);
              setSelectedTypeIdx(found.typeIdx);
              setSelectedOptionId(found.option.id);
            } else {
              setSelectedOptionId(id);
            }
          }}
        >
          {allOptionsFlat.map((o) => (
            <option key={o.option.id} value={o.option.id}>
              {o.pathLabel}
            </option>
          ))}
        </select>
      </div>

      {/* Configure questions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-slate-800">Configured Questions</div>
          {!selectedOption || (selectedOption.configQuestions || []).length === 0 ? (
            <p className="text-sm text-slate-500">No questions linked yet.</p>
          ) : (
            <div className="space-y-2">
              {(selectedOption.configQuestions || []).map((q, idx) => (
                <div key={idx} className="flex items-center gap-2 border rounded p-2">
                  <span className="text-xs rounded bg-slate-100 px-2 py-1">
                    {q.source === "legacy" ? "Legacy Field" : "Component Attribute"}
                  </span>
                  <Input
                    value={q.label || (q.source === "legacy" ? (questionnaire.find((f) => f.key === (q as any).fieldKey)?.label || (q as any).fieldKey) : (q as any).attributeName)}
                    onChange={(e) => updateLabel(idx, e.target.value)}
                    className="flex-1"
                    placeholder="Question label"
                  />
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={!!q.required}
                      onChange={(e) => toggleRequired(idx, e.target.checked)}
                    />
                    Required
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => removeQuestion(idx)} className="text-red-600">
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-800">Add Questions</div>

          {/* Add legacy questionnaire field */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600">From Legacy Fields</label>
            <div className="flex gap-2">
              <select id="legacyField" className="flex-1 rounded-md border p-2 text-sm" defaultValue="">
                <option value="" disabled>
                  Select field...
                </option>
                {questionnaire.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                onClick={() => {
                  const sel = (document.getElementById("legacyField") as HTMLSelectElement | null)?.value || "";
                  addLegacyField(sel);
                }}
              >
                Add Field
              </Button>
            </div>
          </div>

          {/* Add component attribute question */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600">From Component Attributes</label>
            <div className="flex gap-2">
              <select
                id="componentTypeSelect"
                className="flex-1 rounded-md border p-2 text-sm"
                defaultValue=""
                onChange={async (e) => {
                  const t = e.target.value;
                  if (t) await ensureAttributesLoaded(t);
                }}
              >
                <option value="" disabled>
                  Select component type...
                </option>
                {componentTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select id="attributeSelect" className="flex-1 rounded-md border p-2 text-sm" defaultValue="">
                <option value="" disabled>
                  Select attribute...
                </option>
                {(attributesByType[(document.getElementById("componentTypeSelect") as HTMLSelectElement | null)?.value || ""] || []).map((a) => (
                  <option key={`${a.componentType}:${a.attributeName}`} value={`${a.componentType}|${a.attributeName}`}>
                    {a.componentType} • {a.attributeName}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                onClick={() => {
                  const raw = (document.getElementById("attributeSelect") as HTMLSelectElement | null)?.value || "";
                  if (!raw) return;
                  const [componentType, attributeName] = raw.split("|");
                  addComponentAttribute(componentType, attributeName);
                }}
              >
                Add Attribute
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
