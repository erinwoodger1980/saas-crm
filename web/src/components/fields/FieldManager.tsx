/**
 * Field Manager Component
 * Simple admin interface for creating fields
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getAuthIdsFromJwt } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

interface QuestionnaireField {
  id: string;
  key: string;
  label: string;
  type: string;
  scope: string;
  helpText?: string | null;
}

interface FieldManagerProps {
  defaultScope: string;
  editingField?: QuestionnaireField | null;
  onSave: () => Promise<void>;
  onClose: () => void;
}

const FIELD_TYPES = ['TEXT', 'NUMBER', 'SELECT', 'BOOLEAN', 'TEXTAREA', 'DATE'];
const SCOPES = ['client', 'lead', 'line_item', 'manufacturing', 'fire_door_project', 'fire_door_line_item'];

export function FieldManager({ defaultScope, editingField, onSave, onClose }: FieldManagerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isEditMode = !!editingField;
  const [formData, setFormData] = useState(() => {
    if (editingField) {
      return {
        key: editingField.key,
        label: editingField.label,
        type: editingField.type,
        scope: editingField.scope,
        helpText: editingField.helpText || '',
      };
    }
    return {
      key: '',
      label: '',
      type: 'TEXT',
      scope: defaultScope,
      helpText: '',
    };
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.key || !formData.label) {
      toast({
        title: 'Error',
        description: 'Key and Label are required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const auth = getAuthIdsFromJwt();
      if (!auth) throw new Error('Not authenticated');

      if (isEditMode && editingField) {
        // Edit existing field
        await apiFetch(`/api/flexible-fields/fields/${editingField.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': auth.userId,
            'x-tenant-id': auth.tenantId,
          },
          json: {
            label: formData.label,
            type: formData.type,
            helpText: formData.helpText,
          },
        });

        toast({
          title: 'Success',
          description: 'Field updated successfully',
        });
      } else {
        // Create new field
        await apiFetch('/api/flexible-fields/fields', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': auth.userId,
            'x-tenant-id': auth.tenantId,
          },
          json: {
            ...formData,
            isStandard: false,
            isActive: true,
          },
        });

        toast({
          title: 'Success',
          description: 'Field created successfully',
        });
      }

      await onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save field:', error);
      toast({
        title: 'Error',
        description: isEditMode ? 'Failed to update field' : 'Failed to create field',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Field' : 'Create New Field'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the field configuration' : 'Define a new custom field for your workspace'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="key">Field Key *</Label>
            <Input
              id="key"
              value={formData.key}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({
                  ...formData,
                  key: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                })
              }
              placeholder="e.g., company_name"
              disabled={isEditMode}
              required
            />
            <p className="text-xs text-slate-500 mt-1">Unique identifier, cannot be changed</p>
          </div>

          <div>
            <Label htmlFor="label">Label *</Label>
            <Input
              id="label"
              value={formData.label}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, label: e.target.value })
              }
              placeholder="e.g., Company Name"
              required
            />
          </div>

          <div>
            <Label htmlFor="type">Type *</Label>
            <Select value={formData.type} onValueChange={(value: string) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="scope">Scope *</Label>
            <Select value={formData.scope} onValueChange={(value: string) => setFormData({ ...formData, scope: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="helpText">Help Text</Label>
            <Textarea
              id="helpText"
              value={formData.helpText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData({ ...formData, helpText: e.target.value })
              }
              placeholder="Optional help text for users"
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Field' : 'Create Field')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
