'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Edit, Eye, Trash2, CheckCircle, Clock, FileText } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  landingTenant: {
    id: string;
    publishedAt: string | null;
  } | null;
  _count?: {
    images: number;
    reviews: number;
  };
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTenants() {
      try {
        const data = await apiFetch<{ tenants: Tenant[] }>('/admin/landing-tenants');
        setTenants(data.tenants || []);
      } catch (error) {
        console.error('Failed to fetch tenants:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTenants();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tenants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Landing Pages</h1>
          <p className="text-gray-600 mt-1">Manage tenant landing pages and content</p>
        </div>
        <Link
          href="/admin/tenants/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          New Tenant
        </Link>
      </div>

      {tenants.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No tenants yet</h3>
          <p className="text-gray-600 mb-6">Get started by creating your first tenant landing page</p>
          <Link
            href="/admin/tenants/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Create First Tenant
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 text-sm font-semibold text-gray-900">Tenant</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-900">Slug</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-900">Status</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-900">Content</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-900">Last Updated</th>
                <th className="text-right p-4 text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50 transition">
                  <td className="p-4">
                    <div className="font-medium text-gray-900">{tenant.name}</div>
                  </td>
                  <td className="p-4">
                    <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {tenant.slug}
                    </code>
                  </td>
                  <td className="p-4">
                    {tenant.landingTenant?.publishedAt ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                        <CheckCircle size={14} />
                        Published
                      </span>
                    ) : tenant.landingTenant ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-medium">
                        <Clock size={14} />
                        Draft
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                        No Content
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {tenant.landingTenant?._count && (
                      <div className="flex gap-3">
                        <span>{tenant.landingTenant._count.images} images</span>
                        <span>{tenant.landingTenant._count.reviews} reviews</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {tenant.landingTenant?.publishedAt
                      ? new Date(tenant.landingTenant.publishedAt).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/tenants/${tenant.slug}/ads-link`}
                        className="px-3 py-1.5 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded transition border border-purple-200"
                        title="Ads Setup"
                      >
                        Ads Setup
                      </Link>
                      <Link
                        href={`/admin/ads/${tenant.id}`}
                        className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition"
                        title="Ads Insights"
                      >
                        Insights
                      </Link>
                      <Link
                        href={`/admin/tenants/${tenant.id}/edit`}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </Link>
                      <Link
                        href={`/${tenant.slug}/kent`}
                        target="_blank"
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition"
                        title="Preview"
                      >
                        <Eye size={18} />
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${tenant.name}?`)) {
                            // TODO: Implement delete
                            console.log('Delete:', tenant.id);
                          }
                        }}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
