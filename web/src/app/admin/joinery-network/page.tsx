'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

type NetworkMember = {
  id: string;
  tenantId: string;
  status: string;
  requestedAt: string;
  approvedAt?: string | null;
  tenant?: { id: string; name: string; slug: string } | null;
  requestedBy?: { id: string; email?: string | null; name?: string | null } | null;
  approvedBy?: { id: string; email?: string | null; name?: string | null } | null;
};

type Evidence = {
  id: string;
  kind: string;
  title?: string | null;
  description?: string | null;
  productTypeId?: string | null;
  createdAt: string;
};

type DoP = {
  id: string;
  productTypeId: string;
  version: string;
  status: string;
  createdAt: string;
};

type Fpc = {
  id: string;
  version: string;
  status: string;
  createdAt: string;
};

type ProductType = { id: string; name: string; code: string; level: string };

export default function JoineryNetworkAdminPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<NetworkMember[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [dops, setDops] = useState<DoP[]>([]);
  const [fpcs, setFpcs] = useState<Fpc[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);

  const [newEvidence, setNewEvidence] = useState({
    kind: 'OTHER',
    title: '',
    description: '',
    productTypeId: '',
  });
  const [newDoP, setNewDoP] = useState({
    productTypeId: '',
    version: '',
    status: 'DRAFT',
    performance: '{}',
    evidenceIds: '',
  });
  const [newFpc, setNewFpc] = useState({
    version: '',
    status: 'DRAFT',
    details: '{}',
    evidenceIds: '',
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, evRes, dopRes, fpcRes, ptRes] = await Promise.all([
        apiFetch<{ items: NetworkMember[] }>(`/network/authorisation/requests?status=PENDING`),
        apiFetch<{ items: Evidence[] }>(`/evidence`),
        apiFetch<{ items: DoP[] }>(`/dop`),
        apiFetch<{ items: Fpc[] }>(`/fpc`),
        apiFetch<ProductType[]>(`/product-types`),
      ]);

      setRequests(reqRes.items || []);
      setEvidence(evRes.items || []);
      setDops(dopRes.items || []);
      setFpcs(fpcRes.items || []);
      setProductTypes(Array.isArray(ptRes) ? ptRes : []);
    } catch (e: any) {
      toast({ title: 'Failed to load TJN admin data', description: e?.message || '', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const productTypeOptions = useMemo(
    () => productTypes.filter((p) => p.level === 'type' || p.level === 'option'),
    [productTypes]
  );

  async function approveRequest(id: string) {
    await apiFetch(`/network/authorisation/${id}/approve`, { method: 'POST', json: {} });
    toast({ title: 'Approved', description: 'Tenant authorised.' });
    void loadAll();
  }

  async function rejectRequest(id: string) {
    await apiFetch(`/network/authorisation/${id}/reject`, { method: 'POST', json: {} });
    toast({ title: 'Rejected', description: 'Request rejected.' });
    void loadAll();
  }

  async function createEvidence() {
    await apiFetch(`/evidence`, {
      method: 'POST',
      json: {
        kind: newEvidence.kind,
        title: newEvidence.title || undefined,
        description: newEvidence.description || undefined,
        productTypeId: newEvidence.productTypeId || undefined,
      },
    });
    setNewEvidence({ kind: 'OTHER', title: '', description: '', productTypeId: '' });
    toast({ title: 'Evidence created' });
    void loadAll();
  }

  async function createDoP() {
    let performance: any = undefined;
    try {
      performance = newDoP.performance.trim() ? JSON.parse(newDoP.performance) : undefined;
    } catch (e: any) {
      toast({ title: 'Invalid performance JSON', description: e?.message || '', variant: 'destructive' });
      return;
    }
    const evidenceIds = newDoP.evidenceIds
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    await apiFetch(`/dop`, {
      method: 'POST',
      json: {
        productTypeId: newDoP.productTypeId,
        version: newDoP.version,
        status: newDoP.status,
        performance,
        evidenceIds,
      },
    });
    setNewDoP({ productTypeId: '', version: '', status: 'DRAFT', performance: '{}', evidenceIds: '' });
    toast({ title: 'DoP created' });
    void loadAll();
  }

  async function createFpc() {
    let details: any = undefined;
    try {
      details = newFpc.details.trim() ? JSON.parse(newFpc.details) : undefined;
    } catch (e: any) {
      toast({ title: 'Invalid details JSON', description: e?.message || '', variant: 'destructive' });
      return;
    }
    const evidenceIds = newFpc.evidenceIds
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    await apiFetch(`/fpc`, {
      method: 'POST',
      json: {
        version: newFpc.version,
        status: newFpc.status,
        details,
        evidenceIds,
      },
    });
    setNewFpc({ version: '', status: 'DRAFT', details: '{}', evidenceIds: '' });
    toast({ title: 'FPC created' });
    void loadAll();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Joinery Network...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">The Joinery Network</h1>
        <p className="text-gray-600 mt-1">Authorisations, evidence, DoP and FPC management</p>
      </div>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Authorisation Requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-gray-500">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{req.tenant?.name || req.tenantId}</div>
                  <div className="text-xs text-gray-500">Slug: {req.tenant?.slug || '—'}</div>
                  <div className="text-xs text-gray-500">Requested: {new Date(req.requestedAt).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => approveRequest(req.id)}>Approve</Button>
                  <Button variant="outline" onClick={() => rejectRequest(req.id)}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">Create Evidence</h2>
          <div className="space-y-2">
            <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Title" value={newEvidence.title} onChange={(e) => setNewEvidence((p) => ({ ...p, title: e.target.value }))} />
            <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Description" value={newEvidence.description} onChange={(e) => setNewEvidence((p) => ({ ...p, description: e.target.value }))} />
            <select className="w-full rounded border px-3 py-2 text-sm" value={newEvidence.kind} onChange={(e) => setNewEvidence((p) => ({ ...p, kind: e.target.value }))}>
              {['TEST_REPORT','CERTIFICATE','TECHNICAL_FILE','SPECIFICATION','DECLARATION','PROCEDURE','PHOTO','OTHER'].map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <select className="w-full rounded border px-3 py-2 text-sm" value={newEvidence.productTypeId} onChange={(e) => setNewEvidence((p) => ({ ...p, productTypeId: e.target.value }))}>
              <option value="">Product Type (optional)</option>
              {productTypeOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
            <Button className="w-full" onClick={createEvidence}>Create Evidence</Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">Create DoP</h2>
          <div className="space-y-2">
            <select className="w-full rounded border px-3 py-2 text-sm" value={newDoP.productTypeId} onChange={(e) => setNewDoP((p) => ({ ...p, productTypeId: e.target.value }))}>
              <option value="">Product Type</option>
              {productTypeOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
            <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Version" value={newDoP.version} onChange={(e) => setNewDoP((p) => ({ ...p, version: e.target.value }))} />
            <select className="w-full rounded border px-3 py-2 text-sm" value={newDoP.status} onChange={(e) => setNewDoP((p) => ({ ...p, status: e.target.value }))}>
              {['DRAFT','ACTIVE','SUPERSEDED','WITHDRAWN'].map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <textarea className="w-full rounded border px-3 py-2 text-xs" rows={4} placeholder="Performance JSON" value={newDoP.performance} onChange={(e) => setNewDoP((p) => ({ ...p, performance: e.target.value }))} />
            <input className="w-full rounded border px-3 py-2 text-xs" placeholder="Evidence IDs (comma separated)" value={newDoP.evidenceIds} onChange={(e) => setNewDoP((p) => ({ ...p, evidenceIds: e.target.value }))} />
            <Button className="w-full" onClick={createDoP}>Create DoP</Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">Create FPC</h2>
          <div className="space-y-2">
            <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Version" value={newFpc.version} onChange={(e) => setNewFpc((p) => ({ ...p, version: e.target.value }))} />
            <select className="w-full rounded border px-3 py-2 text-sm" value={newFpc.status} onChange={(e) => setNewFpc((p) => ({ ...p, status: e.target.value }))}>
              {['DRAFT','ACTIVE','SUSPENDED','WITHDRAWN'].map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <textarea className="w-full rounded border px-3 py-2 text-xs" rows={4} placeholder="Details JSON" value={newFpc.details} onChange={(e) => setNewFpc((p) => ({ ...p, details: e.target.value }))} />
            <input className="w-full rounded border px-3 py-2 text-xs" placeholder="Evidence IDs (comma separated)" value={newFpc.evidenceIds} onChange={(e) => setNewFpc((p) => ({ ...p, evidenceIds: e.target.value }))} />
            <Button className="w-full" onClick={createFpc}>Create FPC</Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">Evidence</h2>
          {evidence.length === 0 ? <p className="text-sm text-gray-500">No evidence yet.</p> : (
            <ul className="space-y-2 text-sm">
              {evidence.map((e) => (
                <li key={e.id} className="border rounded p-2">
                  <div className="font-medium">{e.title || e.id}</div>
                  <div className="text-xs text-gray-500">{e.kind} • {new Date(e.createdAt).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">DoPs</h2>
          {dops.length === 0 ? <p className="text-sm text-gray-500">No DoPs yet.</p> : (
            <ul className="space-y-2 text-sm">
              {dops.map((d) => (
                <li key={d.id} className="border rounded p-2">
                  <div className="font-medium">{d.productTypeId} • {d.version}</div>
                  <div className="text-xs text-gray-500">{d.status} • {new Date(d.createdAt).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">FPC</h2>
          {fpcs.length === 0 ? <p className="text-sm text-gray-500">No FPC records yet.</p> : (
            <ul className="space-y-2 text-sm">
              {fpcs.map((f) => (
                <li key={f.id} className="border rounded p-2">
                  <div className="font-medium">{f.version}</div>
                  <div className="text-xs text-gray-500">{f.status} • {new Date(f.createdAt).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
