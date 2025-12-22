/**
 * Custom Fields Panel
 * Reusable panel for displaying and editing custom fields
 * Can be integrated into modals, drawers, or pages
 */

'use client';

import { useState, useEffect } from 'react';
import { FieldForm } from './FieldRenderer';
import { useFields } from '@/hooks/useFields';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { getAuthIdsFromJwt } from '@/lib/auth';

interface CustomFieldsPanelProps {
  entityType: 'lead' | 'client' | 'line_item' | 'opportunity';
  entityId: string;
  readOnly?: boolean;
  onSave?: () => void;
}

export function CustomFieldsPanel({
  entityType,
  entityId,
  readOnly = false,
  onSave,
}: CustomFieldsPanelProps) {
  const { toast } = useToast();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Map entity type to field scope
  const scopeMap: Record<string, string> = {
    lead: 'lead',
    client: 'client',
    line_item: 'line_item',
    opportunity: 'lead', // opportunities use lead fields
  };

  // Map entity type to display context
  const contextMap: Record<string, string> = {
    lead: 'lead_modal_details',
    client: 'client_detail',
    line_item: 'quote_line_editor',
    opportunity: 'lead_detail',
  };

  const { fields, isLoading: fieldsLoading } = useFields({
    scope: scopeMap[entityType],
    // Don't filter by context - show all fields for the scope
    // This ensures fields show even if display contexts aren't configured yet
    context: undefined,
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

  const handleFieldBlur = async (fieldKey: string, value: any) => {
    try {
      const auth = getAuthIdsFromJwt();
      if (!auth) throw new Error('Not authenticated');

      const updatedValues = { ...customFieldValues, [fieldKey]: value };
      setCustomFieldValues(updatedValues);

      await apiFetch(`/${entityType}s/${entityId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': auth.userId,
          'x-tenant-id': auth.tenantId,
        },
        json: {
          custom: updatedValues,
        },
      });

      onSave?.();
    } catch (error) {
      console.error('Failed to save custom field:', error);
      // Silently fail - don't show error toast for auto-save
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
      <FieldForm
        fields={fields as any}
        values={customFieldValues}
        onChange={setCustomFieldValues}
        onBlur={readOnly ? undefined : handleFieldBlur}
        disabled={readOnly}
      />
    </div>
  );
}
