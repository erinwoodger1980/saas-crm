'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, AlertCircle, CheckCircle2, Clock, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api';

interface RFI {
  id: string;
  field: string;
  question: string;
  status: 'open' | 'answered' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  response?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  resolvedAt?: string | null;
  visibleToCustomer: boolean;
  lineItem: {
    id: string;
    mjsNumber: string | null;
    jobLocation: string | null;
  };
  creator: {
    firstName: string;
    lastName: string;
  };
  assignee?: {
    firstName: string;
    lastName: string;
  } | null;
}

interface FireDoorRFIPanelProps {
  projectId?: string;
  lineItemId?: string;
  onClose: () => void;
  onRFICreated?: () => void;
}

export function FireDoorRFIPanel({ projectId, lineItemId, onClose, onRFICreated }: FireDoorRFIPanelProps) {
  const [rfis, setRfis] = useState<RFI[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRFI, setSelectedRFI] = useState<RFI | null>(null);
  const [lineItems, setLineItems] = useState<Array<{ id: string; mjsNumber: string; jobLocation: string }>>([]);
  
  // Create form state
  const [newRFI, setNewRFI] = useState({
    fireDoorLineItemId: lineItemId || '',
    field: '',
    question: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    visibleToCustomer: true,
  });

  // Response form state
  const [response, setResponse] = useState('');
  const [responding, setResponding] = useState(false);

  // Auto-open create form if lineItemId is provided
  useEffect(() => {
    if (lineItemId) {
      setShowCreateForm(true);
      setNewRFI(prev => ({ ...prev, fireDoorLineItemId: lineItemId }));
    }
  }, [lineItemId]);

  useEffect(() => {
    fetchRFIs();
    if (projectId) fetchLineItems();
  }, [projectId, lineItemId]);

  async function fetchLineItems() {
    if (!projectId) return;
    try {
      const params = new URLSearchParams({ projectId });
      const data = await apiFetch<any[]>(`/api/fire-door-schedule/items?${params.toString()}`);
      setLineItems(data.map(item => ({
        id: item.id,
        mjsNumber: item.mjsNumber || 'No MJS',
        jobLocation: item.jobLocation || 'No Location',
      })));
    } catch (error) {
      console.error('Error fetching line items:', error);
    }
  }

  async function fetchRFIs() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId);
      if (lineItemId) params.append('fireDoorLineItemId', lineItemId);
      
      const data = await apiFetch<RFI[]>(`/api/fire-door-rfis?${params.toString()}`);
      setRfis(data);
    } catch (error) {
      console.error('Error fetching RFIs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createRFI() {
    try {
      const created = await apiFetch<RFI>('/api/fire-door-rfis', {
        method: 'POST',
        json: newRFI,
      });
      
      setRfis([created, ...rfis]);
      setShowCreateForm(false);
      setNewRFI({
        fireDoorLineItemId: lineItemId || '',
        field: '',
        question: '',
        priority: 'medium',
        visibleToCustomer: true,
      });
      
      if (onRFICreated) onRFICreated();
    } catch (error) {
      console.error('Error creating RFI:', error);
      alert('Failed to create RFI');
    }
  }

  async function respondToRFI(rfiId: string) {
    try {
      setResponding(true);
      const updated = await apiFetch<RFI>(`/api/fire-door-rfis/${rfiId}`, {
        method: 'PATCH',
        json: {
          response,
          status: 'answered',
        },
      });
      
      setRfis(rfis.map(r => r.id === rfiId ? updated : r));
      setResponse('');
      setSelectedRFI(null);
    } catch (error) {
      console.error('Error responding to RFI:', error);
      alert('Failed to respond to RFI');
    } finally {
      setResponding(false);
    }
  }

  async function closeRFI(rfiId: string) {
    try {
      const updated = await apiFetch<RFI>(`/api/fire-door-rfis/${rfiId}`, {
        method: 'PATCH',
        json: { status: 'closed' },
      });
      
      setRfis(rfis.map(r => r.id === rfiId ? updated : r));
    } catch (error) {
      console.error('Error closing RFI:', error);
      alert('Failed to close RFI');
    }
  }

  async function deleteRFI(rfiId: string) {
    if (!confirm('Are you sure you want to delete this RFI?')) return;
    
    try {
      await apiFetch(`/api/fire-door-rfis/${rfiId}`, {
        method: 'DELETE',
      });
      
      setRfis(rfis.filter(r => r.id !== rfiId));
      if (selectedRFI?.id === rfiId) setSelectedRFI(null);
    } catch (error) {
      console.error('Error deleting RFI:', error);
      alert('Failed to delete RFI');
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'open': return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'answered': return <MessageSquare className="w-4 h-4 text-blue-600" />;
      case 'closed': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  }

  const openRFIs = rfis.filter(r => r.status === 'open');
  const answeredRFIs = rfis.filter(r => r.status === 'answered');
  const closedRFIs = rfis.filter(r => r.status === 'closed');

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="flex items-center gap-2 text-white">
          <MessageSquare className="w-5 h-5" />
          <h2 className="text-lg font-semibold">RFIs ({rfis.length})</h2>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 rounded-lg p-1.5 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
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

      {/* Create Button */}
      <div className="p-4 border-b border-gray-200">
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New RFI
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="p-4 bg-blue-50 border-b border-blue-200 space-y-3">
          {!lineItemId && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Line Item</label>
              <select
                value={newRFI.fireDoorLineItemId}
                onChange={(e) => setNewRFI({ ...newRFI, fireDoorLineItemId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
              >
                <option value="">Select a line item...</option>
                {lineItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.mjsNumber} - {item.jobLocation}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Field Name</label>
            <Input
              value={newRFI.field}
              onChange={(e) => setNewRFI({ ...newRFI, field: e.target.value })}
              placeholder="e.g., Fire Rating, Core Type, etc."
              className="bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Question</label>
            <Textarea
              value={newRFI.question}
              onChange={(e) => setNewRFI({ ...newRFI, question: e.target.value })}
              placeholder="What information do you need?"
              className="bg-white"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={newRFI.priority}
              onChange={(e) => setNewRFI({ ...newRFI, priority: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newRFI.visibleToCustomer}
              onChange={(e) => setNewRFI({ ...newRFI, visibleToCustomer: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label className="text-sm text-gray-700">Visible to customer</label>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={createRFI}
              disabled={!newRFI.field || !newRFI.question || !newRFI.fireDoorLineItemId}
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
            >
              Create RFI
            </Button>
            <Button
              onClick={() => setShowCreateForm(false)}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* RFI List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : rfis.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm">No RFIs yet</p>
            <p className="text-xs mt-1">Create one to track missing information</p>
          </div>
        ) : (
          rfis.map((rfi) => (
            <div
              key={rfi.id}
              className={`bg-white rounded-lg border-2 p-3 cursor-pointer transition ${
                selectedRFI?.id === rfi.id ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedRFI(selectedRFI?.id === rfi.id ? null : rfi)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(rfi.status)}
                  <span className="text-xs font-medium text-gray-900">{rfi.field}</span>
                </div>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getPriorityColor(rfi.priority)}`}>
                  {rfi.priority}
                </span>
              </div>
              
              <p className="text-sm text-gray-700 mb-2">{rfi.question}</p>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <span>{rfi.lineItem.mjsNumber || 'No MJS'}</span>
                  {rfi.visibleToCustomer && (
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                      Customer Visible
                    </span>
                  )}
                </div>
                <span>{new Date(rfi.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Response Section */}
              {selectedRFI?.id === rfi.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                  {rfi.response ? (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xs font-medium text-blue-900 mb-1">Response:</div>
                      <p className="text-sm text-blue-800">{rfi.response}</p>
                      {rfi.respondedAt && (
                        <div className="text-xs text-blue-600 mt-2">
                          Responded {new Date(rfi.respondedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : rfi.status === 'open' && (
                    <div className="space-y-2">
                      <Textarea
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        placeholder="Type your response..."
                        rows={3}
                        className="text-sm"
                      />
                      <Button
                        onClick={() => respondToRFI(rfi.id)}
                        disabled={!response || responding}
                        className="w-full bg-blue-600 text-white hover:bg-blue-700"
                        size="sm"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send Response
                      </Button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {rfi.status !== 'closed' && (
                      <Button
                        onClick={() => closeRFI(rfi.id)}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-green-700 border-green-300 hover:bg-green-50"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Close
                      </Button>
                    )}
                    <Button
                      onClick={() => deleteRFI(rfi.id)}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-red-700 border-red-300 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
