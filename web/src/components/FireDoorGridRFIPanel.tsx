'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, MessageSquare, AlertCircle, CheckCircle2, Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api';

type GridRfi = {
  id: string;
  projectId: string;
  rowId: string | null;
  columnKey: string;
  title: string | null;
  message: string;
  status: 'open' | 'answered' | 'closed' | string;
  visibleToClient: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function FireDoorGridRFIPanel({
  importId,
  onClose,
  onChanged,
}: {
  importId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [rfis, setRfis] = useState<GridRfi[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRfiId, setSelectedRfiId] = useState<string | null>(null);
  const [doorRefByRowId, setDoorRefByRowId] = useState<Record<string, string>>({});

  const [newRfi, setNewRfi] = useState({
    columnKey: '',
    rowId: '' as string,
    title: '',
    message: '',
    visibleToClient: true,
  });

  async function fetchRFIs() {
    try {
      setLoading(true);
      const res = await apiFetch<{ ok: boolean; items: GridRfi[] }>(
        `/rfis?projectId=${encodeURIComponent(importId)}&includeClosed=true`
      );
      setRfis(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      console.error('[fire-door-grid-rfis] Failed to load RFIs', e);
      setRfis([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRFIs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importId]);

  useEffect(() => {
    let cancelled = false;
    async function loadDoorRefs() {
      try {
        // Only used for nicer display labels in the RFI manager.
        const res = await apiFetch<any>(`/fire-doors/imports/${encodeURIComponent(importId)}`);
        const items = Array.isArray(res?.lineItems) ? res.lineItems : [];
        const next: Record<string, string> = {};
        for (const it of items) {
          const id = String((it as any)?.id || '').trim();
          if (!id) continue;
          const dr = (it as any)?.doorRef;
          const label = dr == null ? '' : String(dr).trim();
          if (label) next[id] = label;
        }
        if (!cancelled) setDoorRefByRowId(next);
      } catch (e) {
        if (!cancelled) setDoorRefByRowId({});
      }
    }
    if (importId) loadDoorRefs();
    return () => {
      cancelled = true;
    };
  }, [importId]);

  const openRFIs = useMemo(() => rfis.filter((r) => r.status === 'open'), [rfis]);
  const answeredRFIs = useMemo(() => rfis.filter((r) => r.status === 'answered'), [rfis]);
  const closedRFIs = useMemo(() => rfis.filter((r) => r.status === 'closed'), [rfis]);

  function getStatusIcon(status: string) {
    switch (status) {
      case 'open':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'answered':
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      case 'closed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  }

  async function createRFI() {
    if (!newRfi.columnKey.trim() || !newRfi.message.trim()) return;
    try {
      const created = await apiFetch<{ ok: boolean; item: GridRfi }>(`/rfis`, {
        method: 'POST',
        json: {
          projectId: importId,
          rowId: newRfi.rowId.trim() ? newRfi.rowId.trim() : null,
          columnKey: newRfi.columnKey.trim(),
          title: newRfi.title.trim() ? newRfi.title.trim() : null,
          message: newRfi.message.trim(),
          visibleToClient: !!newRfi.visibleToClient,
        },
      });

      if (created?.ok && created.item) {
        setRfis([created.item, ...rfis]);
        setShowCreateForm(false);
        setNewRfi({ columnKey: '', rowId: '', title: '', message: '', visibleToClient: true });
        onChanged?.();
      }
    } catch (e) {
      console.error('[fire-door-grid-rfis] Failed to create RFI', e);
      alert('Failed to create RFI');
    }
  }

  async function updateStatus(rfiId: string, status: 'open' | 'answered' | 'closed') {
    try {
      const updated = await apiFetch<{ ok: boolean; item: GridRfi }>(`/rfis/${rfiId}`, {
        method: 'PUT',
        json: { status },
      });
      if (updated?.ok && updated.item) {
        setRfis(rfis.map((r) => (r.id === rfiId ? updated.item : r)));
        onChanged?.();
      }
    } catch (e) {
      console.error('[fire-door-grid-rfis] Failed to update status', e);
      alert('Failed to update RFI');
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="flex items-center gap-2 text-white">
          <MessageSquare className="w-5 h-5" />
          <h2 className="text-lg font-semibold">RFIs ({rfis.length})</h2>
        </div>
        <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-1.5 transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 p-4 bg-gray-50 border-b border-gray-200">
        <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
          <div className="text-2xl font-bold text-orange-700">{openRFIs.length}</div>
          <div className="text-xs text-orange-600 font-medium">Open</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="text-2xl font-bold text-blue-700">{answeredRFIs.length}</div>
          <div className="text-xs text-blue-600 font-medium">Answered</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="text-2xl font-bold text-green-700">{closedRFIs.length}</div>
          <div className="text-xs text-green-600 font-medium">Closed</div>
        </div>
      </div>

      <div className="p-4 border-b border-gray-200">
        <Button
          onClick={() => setShowCreateForm((v) => !v)}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New RFI
        </Button>
      </div>

      {showCreateForm && (
        <div className="p-4 bg-blue-50 border-b border-blue-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Column Key</label>
            <Input
              value={newRfi.columnKey}
              onChange={(e) => setNewRfi({ ...newRfi, columnKey: e.target.value })}
              placeholder="e.g. location"
              className="bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Row Id (optional)</label>
            <Input
              value={newRfi.rowId}
              onChange={(e) => setNewRfi({ ...newRfi, rowId: e.target.value })}
              placeholder="Paste row id for a cell-specific RFI"
              className="bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title (optional)</label>
            <Input
              value={newRfi.title}
              onChange={(e) => setNewRfi({ ...newRfi, title: e.target.value })}
              placeholder="Short summary"
              className="bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
            <Textarea
              value={newRfi.message}
              onChange={(e) => setNewRfi({ ...newRfi, message: e.target.value })}
              placeholder="Describe what’s missing / needed"
              className="bg-white"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newRfi.visibleToClient}
              onChange={(e) => setNewRfi({ ...newRfi, visibleToClient: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label className="text-sm text-gray-700">Visible to client</label>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={createRFI}
              disabled={!newRfi.columnKey.trim() || !newRfi.message.trim()}
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
            >
              Create RFI
            </Button>
            <Button onClick={() => setShowCreateForm(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : rfis.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm">No RFIs yet</p>
            <p className="text-xs mt-1">Create one or add an RFI from a cell</p>
          </div>
        ) : (
          rfis.map((rfi) => {
            const selected = selectedRfiId === rfi.id;
            const doorRef = rfi.rowId ? doorRefByRowId[String(rfi.rowId)] : undefined;
            const context = rfi.rowId
              ? `Cell: ${doorRef || '(no Door Ref)'} • ${rfi.columnKey}`
              : `Column: ${rfi.columnKey}`;
            return (
              <div
                key={rfi.id}
                className={`bg-white rounded-lg border-2 p-3 cursor-pointer transition ${
                  selected ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedRfiId(selected ? null : rfi.id)}
                title={rfi.rowId ? `Row: ${rfi.rowId}` : undefined}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(String(rfi.status))}
                    <span className="text-xs font-medium text-gray-900">{rfi.title || context}</span>
                  </div>
                </div>

                <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap">{rfi.message}</p>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{context}</span>
                  <span>{rfi.createdAt ? new Date(rfi.createdAt).toLocaleDateString() : ''}</span>
                </div>

                {selected && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => updateStatus(rfi.id, 'open')}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={rfi.status === 'open'}
                      >
                        Open
                      </Button>
                      <Button
                        onClick={() => updateStatus(rfi.id, 'answered')}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={rfi.status === 'answered'}
                      >
                        Answered
                      </Button>
                      <Button
                        onClick={() => updateStatus(rfi.id, 'closed')}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-green-700 border-green-300 hover:bg-green-50"
                        disabled={rfi.status === 'closed'}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
