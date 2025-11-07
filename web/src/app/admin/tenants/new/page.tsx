'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export default function NewTenantPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const created = await apiFetch<any>('/admin/landing-tenants', {
        method: 'POST',
        json: { name, slug: slug.trim() || undefined },
      });
      const id = created?.tenant?.id || created?.id;
      if (id) {
        router.push(`/admin/tenants/${id}/edit`);
      } else {
        setError('Created tenant but missing id in response');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create tenant');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/admin/tenants" className="text-blue-600 hover:underline">← Back to tenants</Link>
        <h1 className="text-3xl font-bold mt-2">Create Tenant</h1>
        <p className="text-gray-600">Create a tenant record and seed an empty landing page.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 border border-red-200 bg-red-50 text-red-700 rounded">{error}</div>
      )}

      <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            type="text"
            className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Wealden Joinery"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug (optional)</label>
          <input
            type="text"
            className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. wealden-joinery"
          />
          <p className="text-xs text-gray-500 mt-1">If left blank, a slug will be generated from the name.</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create Tenant'}
        </button>
      </form>
    </div>
  );
}
