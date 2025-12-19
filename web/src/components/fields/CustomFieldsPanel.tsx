/**
 * Custom Fields Panel
 * Reusable panel for displaying and editing custom fields
 * Can be integrated into modals, drawers, or pages
 */

'use client';

import { useState, useEffect } from 'react';
import { FieldForm } from './FieldRenderer';
import { useFields } from '@/hooks/useFields';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { getAuthIdsFromJwt } from '@/lib/auth';

interface CustomFieldsPanelProps {
  entityType: 'lead' | 'client' | 'line_item' | 'opportunity';
  entityId: string;
  onSave?: () => void;
  readOnly?: boolean;
}

export function CustomFieldsPanel({
  entityType,
  entityId,
  onSave,
  readOnly = false,
}: CustomFieldsPanelProps) {
  const { toast } = useToast();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Map entity type to field scope
  const scopeMap: Record<string, string> = {
    lead: 'lead',
    client: 'client',
    line_item: 'line_item',
    opportunity: 'lead', // opportunities use lead fields
  };

  const { fields, isLoading: fieldsLoading } = useFields({
    scope: scopeMap[entityType],
    context: `${entityType}_detail`,
  });

  // Load entity's custom field values
  useEffect(() => {
    const loadCustomFields = async () => {
      setLoading(true);
      try {
        const auth = getAuthIdsFromJwt();
        if (!auth) return;

        // Get entity data to extract custom field values
        const response = await apiFetch(`/${entityType}s/${entityId}`, {
          headers: {
            'x-user-id': auth.userId,
            'x-tenant-id': auth.tenantId,
          },
        });

        const entity = response as any;
        const customData = entity.custom || {};
        setCustomFieldValues(customData);
      } catch (error) {
        console.error('Failed to load custom fields:', error);
      } finally {
        setLoading(false);
      }
    };

    if (entityId) {
      loadCustomFields();
    }
  }, [entityType, entityId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const auth = getAuthIdsFromJwt();
      if (!auth) throw new Error('Not authenticated');

      await apiFetch(`/${entityType}s/${entityId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': auth.userId,
          'x-tenant-id': auth.tenantId,
        },
        json: {
          custom: customFieldValues,
        },
      });

      toast({
        title: 'Success',
        description: 'Custom fields saved',
      });

      onSave?.();
    } catch (error) {
      console.error('Failed to save custom fields:', error);
      toast({
        title: 'Error',
        description: 'Failed to save custom fields',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || fieldsLoading) {
    return <div className="p-4 text-slate-500">Loading fields...</div>;
  }

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4">
      <h3 className="font-semibold text-slate-900">Custom Fields</h3>

      <FieldForm
        fields={fields as any}
        values={customFieldValues}
        onChange={setCustomFieldValues}
        disabled={readOnly}
      />

      {!readOnly && (
        <div className="flex gap-2 justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Custom Fields'}
          </Button>
        </div>
      )}
    </div>
  );
}
