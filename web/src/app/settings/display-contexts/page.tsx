/**
 * Display Context Manager
 * Admin interface for configuring field visibility in different UI contexts
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { getAuthIdsFromJwt } from '@/lib/auth';
import SectionCard from '@/components/SectionCard';

interface DisplayContext {
  id: string;
  fieldId: string;
  context: string;
  isVisible: boolean;
  displayOrder?: number;
}

interface QuestionnaireField {
  id: string;
  key: string;
  label: string;
  scope: string;
}

const DISPLAY_CONTEXTS = [
  { value: 'client_detail', label: 'Client Detail Page' },
  { value: 'client_list', label: 'Client List' },
  { value: 'client_modal', label: 'Client Modal' },
  { value: 'lead_detail', label: 'Lead Detail' },
  { value: 'lead_modal_details', label: 'Lead Modal - Details Tab' },
  { value: 'lead_list', label: 'Lead List' },
  { value: 'quote_form', label: 'Quote Form' },
  { value: 'quote_line_editor', label: 'Quote Line Editor' },
  { value: 'line_item_grid', label: 'Line Item Grid' },
  { value: 'fire_door_modal', label: 'Fire Door Modal' },
  { value: 'fire_door_schedule', label: 'Fire Door Schedule' },
];

export function DisplayContextManager() {
  const { toast } = useToast();
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<QuestionnaireField[]>([]);
  const [displayContexts, setDisplayContexts] = useState<DisplayContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuthIdsFromJwt();
    if (auth) {
      setAuthHeaders({
        'x-user-id': auth.userId,
        'x-tenant-id': auth.tenantId,
      });
    }
  }, []);

  useEffect(() => {
    if (!authHeaders['x-tenant-id']) return;
    loadData();
  }, [authHeaders]);

  async function loadData() {
    setLoading(true);
    try {
      const [fieldsRes, contextsRes] = await Promise.all([
        apiFetch('/api/flexible-fields', { headers: authHeaders }),
        apiFetch('/api/flexible-fields/display-contexts', { headers: authHeaders }),
      ]);

      setFields(Array.isArray(fieldsRes) ? fieldsRes : []);
      setDisplayContexts(Array.isArray(contextsRes) ? contextsRes : []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load display contexts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleVisibility(fieldId: string, context: string, isVisible: boolean) {
    setSaving(true);
    try {
      await apiFetch('/api/flexible-fields/display-contexts', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        json: {
          fieldId,
          context,
          isVisible: !isVisible,
        },
      });

      // Update local state
      setDisplayContexts((prev) => {
        const existing = prev.find((dc) => dc.fieldId === fieldId && dc.context === context);
        if (existing) {
          return prev.map((dc) =>
            dc.fieldId === fieldId && dc.context === context
              ? { ...dc, isVisible: !isVisible }
              : dc
          );
        }
        return [...prev, { id: '', fieldId, context, isVisible: !isVisible }];
      });

      toast({
        title: 'Success',
        description: 'Display context updated',
      });
    } catch (error) {
      console.error('Failed to update display context:', error);
      toast({
        title: 'Error',
        description: 'Failed to update display context',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SectionCard title="Display Context Manager">
        <div className="text-center py-8 text-slate-500">Loading...</div>
      </SectionCard>
    );
  }

  const groupedFields = fields.reduce(
    (acc, field) => {
      if (!acc[field.scope]) acc[field.scope] = [];
      acc[field.scope].push(field);
      return acc;
    },
    {} as Record<string, QuestionnaireField[]>
  );

  return (
    <div className="space-y-6">
      <SectionCard title="Display Context Manager">
        <p className="text-sm text-slate-600 mb-4">
          Configure where custom fields are displayed in your application. Select a field to manage its visibility.
        </p>

        {/* Field Selector */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Select Field</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-200 rounded-lg p-3">
            {Object.entries(groupedFields).map(([scope, scopeFields]) => (
              <div key={scope}>
                <div className="font-medium text-sm text-slate-700 capitalize py-2">{scope.replace(/_/g, ' ')}</div>
                {scopeFields.map((field) => (
                  <button
                    key={field.id}
                    onClick={() => setSelectedField(field.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedField === field.id
                        ? 'bg-sky-600 text-white'
                        : 'hover:bg-slate-100 text-slate-900'
                    }`}
                  >
                    {field.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Context Visibility Table */}
        {selectedField && (
          <div>
            <h3 className="font-semibold mb-3">
              Visibility in Contexts - {fields.find((f) => f.id === selectedField)?.label}
            </h3>
            <div className="space-y-2">
              {DISPLAY_CONTEXTS.map(({ value, label }) => {
                const context = displayContexts.find(
                  (dc) => dc.fieldId === selectedField && dc.context === value
                );
                const isVisible = context?.isVisible ?? true; // Default to visible

                return (
                  <div key={value} className="flex items-center gap-3 p-3 rounded border border-slate-200">
                    <Checkbox
                      id={`context-${value}`}
                      checked={isVisible}
                      onCheckedChange={() =>
                        handleToggleVisibility(selectedField, value, isVisible)
                      }
                      disabled={saving}
                    />
                    <label
                      htmlFor={`context-${value}`}
                      className="flex-1 cursor-pointer text-sm font-medium text-slate-700"
                    >
                      {label}
                    </label>
                    <span className={`text-xs px-2 py-1 rounded ${isVisible ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                      {isVisible ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!selectedField && fields.length > 0 && (
          <div className="p-4 bg-slate-50 rounded text-center text-slate-600 text-sm">
            Select a field to manage its display contexts
          </div>
        )}

        {fields.length === 0 && (
          <div className="p-4 bg-slate-50 rounded text-center text-slate-600 text-sm">
            No fields created yet. Create fields in the Fields Management section.
          </div>
        )}
      </SectionCard>
    </div>
  );
}
