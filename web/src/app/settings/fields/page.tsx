'use client';

import { useEffect, useState } from 'react';
import { getAuthIdsFromJwt } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import SectionCard from '@/components/SectionCard';
import { FieldManager } from '@/components/fields/FieldManager';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface QuestionnaireField {
  id: string;
  key: string;
  label: string;
  scope: string;
  type: string;
  isStandard: boolean;
  isActive: boolean;
  helpText?: string | null;
}

const SCOPES = [
  { value: 'client', label: 'Client Fields' },
  { value: 'lead', label: 'Lead Fields' },
  { value: 'line_item', label: 'Line Item Fields' },
  { value: 'manufacturing', label: 'Manufacturing Fields' },
  { value: 'fire_door_project', label: 'Fire Door Project Fields' },
  { value: 'fire_door_line_item', label: 'Fire Door Line Item Fields' },
];

export default function FieldsPage() {
  const { toast } = useToast();
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<QuestionnaireField[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScope, setSelectedScope] = useState<string>('client');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingField, setEditingField] = useState<QuestionnaireField | null>(null);

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
    loadFields();
  }, [authHeaders, selectedScope]);

  async function loadFields() {
    setLoading(true);
    try {
      const response = await apiFetch<QuestionnaireField[]>(
        `/api/flexible-fields?scope=${selectedScope}`,
        {
          headers: authHeaders,
        }
      );
      setFields(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Failed to load fields:', error);
      toast({
        title: 'Error',
        description: 'Failed to load fields',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteField(fieldId: string) {
    if (!confirm('Are you sure you want to delete this field?')) return;

    try {
      await apiFetch(`/api/flexible-fields/${fieldId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      toast({
        title: 'Success',
        description: 'Field deleted successfully',
      });
      loadFields();
    } catch (error) {
      console.error('Failed to delete field:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete field',
        variant: 'destructive',
      });
    }
  }

  async function handleFieldSaved() {
    setShowCreateDialog(false);
    setEditingField(null);
    loadFields();
  }

  const scopedFields = fields.filter((f) => f.scope === selectedScope);
  const standardFields = scopedFields.filter((f) => f.isStandard);
  const customFields = scopedFields.filter((f) => !f.isStandard);

  return (
    <div className="space-y-6 p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Field Management</h1>
        <p className="text-sm text-slate-500">
          Create and manage custom fields for different scopes in your CRM
        </p>
      </header>

      {/* Scope Selector */}
      <SectionCard title="Field Scope">
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((scope) => (
            <button
              key={scope.value}
              onClick={() => setSelectedScope(scope.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedScope === scope.value
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {scope.label}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Create Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Field
        </Button>
      </div>

      {/* Create/Edit Dialog */}
      {showCreateDialog && (
        <FieldManager
          defaultScope={selectedScope}
          onSave={handleFieldSaved}
          onClose={() => {
            setShowCreateDialog(false);
            setEditingField(null);
          }}
        />
      )}

      {/* Standard Fields */}
      {standardFields.length > 0 && (
        <SectionCard title="Standard Fields">
          <div className="space-y-2">
            {standardFields.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50"
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{field.label}</p>
                  <p className="text-sm text-slate-500">{field.key}</p>
                  <div className="mt-1 flex gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {field.type}
                    </span>
                    {!field.isActive && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-300 text-slate-700">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingField(field);
                      setShowCreateDialog(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Custom Fields */}
      {customFields.length > 0 && (
        <SectionCard title="Custom Fields">
          <div className="space-y-2">
            {customFields.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-200"
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{field.label}</p>
                  <p className="text-sm text-slate-500">{field.key}</p>
                  <div className="mt-1 flex gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {field.type}
                    </span>
                    {!field.isActive && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-300 text-slate-700">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingField(field);
                      setShowCreateDialog(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteField(field.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Empty State */}
      {!loading && scopedFields.length === 0 && (
        <div className="rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500 mb-4">No fields defined for this scope yet</p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Field
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500">Loading fields...</p>
        </div>
      )}
    </div>
  );
}
