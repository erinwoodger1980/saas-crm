"use client";
import useSWR from 'swr';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface FR { id:string; title:string; status:string; createdAt:string; category:string; }

export default function TenantFeaturesPage() {
  const fetcher = (url: string) => apiFetch<FR[]>(url);
  const { data, error } = useSWR<FR[]>("/feature-requests", fetcher);
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Your Feature Requests</h1>
        <a href="/features/new" className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">New Request</a>
      </div>
      {error && <p className="text-red-600">Failed to load</p>}
      {!data && !error && <p className="text-gray-500">Loading…</p>}
      {data && data.length === 0 && <p className="text-gray-600">No requests yet.</p>}
      <ul className="space-y-2">
        {data?.map(fr => (
          <li key={fr.id} className="border rounded p-3 bg-white flex justify-between items-center hover:bg-slate-50">
            <Link href={`/features/${fr.id}`} className="flex-1">
              <div>
                <p className="font-medium">{fr.title}</p>
                <p className="text-xs text-gray-500">{fr.category} · {new Date(fr.createdAt).toLocaleDateString()}</p>
              </div>
            </Link>
            <Link href={`/features/${fr.id}`} className="text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200">{fr.status}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
