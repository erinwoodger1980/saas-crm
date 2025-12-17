'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';

interface LippingLookup {
  id: string;
  doorsetType: string;
  topMm: number | null;
  bottomMm: number | null;
  hingeMm: number | null;
  lockMm: number | null;
  safeHingeMm: number | null;
  daExposedMm: number | null;
  trimMm: number | null;
  postformedMm: number | null;
  extrasMm: number | null;
  commentsForNotes: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface LippingFormData {
  doorsetType: string;
  topMm: string;
  bottomMm: string;
  hingeMm: string;
  lockMm: string;
  safeHingeMm: string;
  daExposedMm: string;
  trimMm: string;
  postformedMm: string;
  extrasMm: string;
  commentsForNotes: string;
}

const emptyFormData: LippingFormData = {
  doorsetType: '',
  topMm: '',
  bottomMm: '',
  hingeMm: '',
  lockMm: '',
  safeHingeMm: '',
  daExposedMm: '',
  trimMm: '',
  postformedMm: '',
  extrasMm: '',
  commentsForNotes: ''
};

export default function LippingLookupPage() {
  const [lippings, setLippings] = useState<LippingLookup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<LippingFormData>(emptyFormData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLippings();
  }, []);

  const fetchLippings = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/lipping-lookup', {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to fetch lipping lookups');
      }

      const data = await res.json();
      setLippings(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching lippings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (lipping: LippingLookup) => {
    setEditingId(lipping.id);
    setFormData({
      doorsetType: lipping.doorsetType,
      topMm: lipping.topMm?.toString() || '',
      bottomMm: lipping.bottomMm?.toString() || '',
      hingeMm: lipping.hingeMm?.toString() || '',
      lockMm: lipping.lockMm?.toString() || '',
      safeHingeMm: lipping.safeHingeMm?.toString() || '',
      daExposedMm: lipping.daExposedMm?.toString() || '',
      trimMm: lipping.trimMm?.toString() || '',
      postformedMm: lipping.postformedMm?.toString() || '',
      extrasMm: lipping.extrasMm?.toString() || '',
      commentsForNotes: lipping.commentsForNotes || ''
    });
  };

  const handleCreate = () => {
    setIsCreating(true);
    setFormData(emptyFormData);
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData(emptyFormData);
    setError(null);
  };

  const handleSave = async () => {
    try {
      setError(null);
      
      const payload = {
        doorsetType: formData.doorsetType,
        topMm: formData.topMm ? parseInt(formData.topMm) : null,
        bottomMm: formData.bottomMm ? parseInt(formData.bottomMm) : null,
        hingeMm: formData.hingeMm ? parseInt(formData.hingeMm) : null,
        lockMm: formData.lockMm ? parseInt(formData.lockMm) : null,
        safeHingeMm: formData.safeHingeMm ? parseInt(formData.safeHingeMm) : null,
        daExposedMm: formData.daExposedMm ? parseInt(formData.daExposedMm) : null,
        trimMm: formData.trimMm ? parseInt(formData.trimMm) : null,
        postformedMm: formData.postformedMm ? parseInt(formData.postformedMm) : null,
        extrasMm: formData.extrasMm ? parseInt(formData.extrasMm) : null,
        commentsForNotes: formData.commentsForNotes || null
      };

      let res;
      if (isCreating) {
        res = await fetch('/api/lipping-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      } else if (editingId) {
        res = await fetch(`/api/lipping-lookup/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      }

      if (!res?.ok) {
        const errorData = await res?.json();
        throw new Error(errorData?.error || 'Failed to save');
      }

      await fetchLippings();
      handleCancel();
    } catch (err: any) {
      setError(err.message);
      console.error('Error saving lipping:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lipping lookup?')) {
      return;
    }

    try {
      const res = await fetch(`/api/lipping-lookup/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to delete');
      }

      await fetchLippings();
    } catch (err: any) {
      setError(err.message);
      console.error('Error deleting lipping:', err);
    }
  };

  const updateFormField = (field: keyof LippingFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center">
          <div className="text-gray-500">Loading lipping lookup table...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lipping Lookup</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage door lipping specifications for different doorset types
          </p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add New
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {isCreating && (
        <div className="mb-6 rounded-lg border-2 border-blue-300 bg-blue-50 p-6">
          <h2 className="mb-4 text-lg font-semibold">New Lipping Lookup</h2>
          <LippingForm
            formData={formData}
            onUpdate={updateFormField}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Doorset Type
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Top
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Bottom
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Hinge
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Lock
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Safe Hinge
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  D/A Exposed
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Trim
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Postformed
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Extras
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Comments
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {lippings.map((lipping) => (
                <tr key={lipping.id} className={editingId === lipping.id ? 'bg-blue-50' : ''}>
                  {editingId === lipping.id ? (
                    <td colSpan={12} className="px-4 py-4">
                      <LippingForm
                        formData={formData}
                        onUpdate={updateFormField}
                        onSave={handleSave}
                        onCancel={handleCancel}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900">
                        {lipping.doorsetType}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-sm text-gray-600">
                        {lipping.topMm ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-sm text-gray-600">
                        {lipping.bottomMm ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-sm text-gray-600">
                        {lipping.hingeMm ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-sm text-gray-600">
                        {lipping.lockMm ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-sm text-gray-600">
                        {lipping.safeHingeMm ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-sm text-gray-600">
                        {lipping.daExposedMm ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-sm text-gray-600">
                        {lipping.trimMm ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-sm text-gray-600">
                        {lipping.postformedMm ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-sm text-gray-600">
                        {lipping.extrasMm ?? '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <div className="max-w-xs truncate" title={lipping.commentsForNotes || ''}>
                          {lipping.commentsForNotes || '-'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(lipping)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(lipping.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {lippings.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-sm text-gray-500">
                    No lipping lookups found. Click "Add New" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface LippingFormProps {
  formData: LippingFormData;
  onUpdate: (field: keyof LippingFormData, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function LippingForm({ formData, onUpdate, onSave, onCancel }: LippingFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Doorset Type *
          </label>
          <input
            type="text"
            value={formData.doorsetType}
            onChange={(e) => onUpdate('doorsetType', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g., STANDARD CONCEALED"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 md:grid-cols-5">
        <div>
          <label className="block text-sm font-medium text-gray-700">Top (mm)</label>
          <input
            type="number"
            value={formData.topMm}
            onChange={(e) => onUpdate('topMm', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="8"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Bottom (mm)</label>
          <input
            type="number"
            value={formData.bottomMm}
            onChange={(e) => onUpdate('bottomMm', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="8"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Hinge (mm)</label>
          <input
            type="number"
            value={formData.hingeMm}
            onChange={(e) => onUpdate('hingeMm', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="8"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Lock (mm)</label>
          <input
            type="number"
            value={formData.lockMm}
            onChange={(e) => onUpdate('lockMm', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="8"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Safe Hinge (mm)</label>
          <input
            type="number"
            value={formData.safeHingeMm}
            onChange={(e) => onUpdate('safeHingeMm', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">D/A Exposed (mm)</label>
          <input
            type="number"
            value={formData.daExposedMm}
            onChange={(e) => onUpdate('daExposedMm', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Trim (mm)</label>
          <input
            type="number"
            value={formData.trimMm}
            onChange={(e) => onUpdate('trimMm', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Postformed (mm)</label>
          <input
            type="number"
            value={formData.postformedMm}
            onChange={(e) => onUpdate('postformedMm', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="4"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Extras (mm)</label>
          <input
            type="number"
            value={formData.extrasMm}
            onChange={(e) => onUpdate('extrasMm', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="5"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Comments for Notes</label>
        <textarea
          value={formData.commentsForNotes}
          onChange={(e) => onUpdate('commentsForNotes', e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Additional manufacturing notes..."
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Save className="h-4 w-4" />
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}
