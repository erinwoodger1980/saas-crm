"use client";

import { useState, useEffect } from "react";
import { Package, Filter, FileText, Clock, CheckCircle, XCircle, Upload } from "lucide-react";
import Link from "next/link";

interface SupplierQuoteRequest {
  id: string;
  status: string;
  notes: string | null;
  quotedAmount: number | null;
  sentAt: string;
  receivedAt: string | null;
  createdAt: string;
  supplier: {
    id: string;
    name: string;
    email: string | null;
    contactPerson: string | null;
  };
  lead: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
  } | null;
  opportunity: {
    id: string;
    title: string | null;
  } | null;
  requestedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  uploadedFile: {
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    createdAt: string;
  } | null;
}

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  quote_received: "bg-blue-100 text-blue-800 border-blue-200",
  accepted: "bg-green-100 text-green-800 border-green-200",
  declined: "bg-gray-100 text-gray-800 border-gray-200",
};

const statusIcons = {
  pending: Clock,
  quote_received: FileText,
  accepted: CheckCircle,
  declined: XCircle,
};

const statusLabels = {
  pending: "Pending",
  quote_received: "Quote Received",
  accepted: "Accepted",
  declined: "Declined",
};

export default function SupplierQuoteRequestsPage() {
  const [requests, setRequests] = useState<SupplierQuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<SupplierQuoteRequest | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [quotedAmount, setQuotedAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      const url = statusFilter === "all" 
        ? "/api/supplier-quote-requests"
        : `/api/supplier-quote-requests?status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error("Failed to fetch supplier quote requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const handleUpdateStatus = async () => {
    if (!selectedRequest || !newStatus) return;

    try {
      const token = localStorage.getItem("token");
      const updateData: any = { status: newStatus };

      if (quotedAmount) {
        updateData.quotedAmount = parseFloat(quotedAmount);
      }

      const res = await fetch(`/api/supplier-quote-requests/${selectedRequest.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        setSuccess("Status updated successfully");
        setShowStatusModal(false);
        setSelectedRequest(null);
        setNewStatus("");
        setQuotedAmount("");
        fetchRequests();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update status");
      }
    } catch (err) {
      setError("Failed to update status");
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLeadName = (lead: SupplierQuoteRequest["lead"]) => {
    if (!lead) return "—";
    if (lead.companyName) return lead.companyName;
    return [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unnamed Lead";
  };

  const filteredRequests = requests;

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-500">Loading quote requests...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-8 h-8" />
            Supplier Quote Requests
          </h1>
        </div>
        <p className="text-gray-600">
          Track and manage quote requests sent to suppliers
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg">
        <Filter className="w-5 h-5 text-gray-500" />
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="quote_received">Quote Received</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No quote requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lead / Opportunity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quoted Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent / Received
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requested By
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request) => {
                  const StatusIcon = statusIcons[request.status as keyof typeof statusIcons] || Clock;
                  return (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{request.supplier.name}</div>
                        {request.supplier.contactPerson && (
                          <div className="text-xs text-gray-500">{request.supplier.contactPerson}</div>
                        )}
                        {request.supplier.email && (
                          <div className="text-xs text-gray-500">{request.supplier.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {request.lead && (
                          <Link
                            href={`/leads/${request.lead.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {getLeadName(request.lead)}
                          </Link>
                        )}
                        {request.opportunity && (
                          <div className="text-xs text-gray-500 mt-1">
                            Opp: {request.opportunity.title || "Untitled"}
                          </div>
                        )}
                        {!request.lead && !request.opportunity && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                            statusColors[request.status as keyof typeof statusColors] || statusColors.pending
                          }`}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusLabels[request.status as keyof typeof statusLabels] || request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatCurrency(request.quotedAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                        <div>Sent: {formatDate(request.sentAt)}</div>
                        {request.receivedAt && (
                          <div className="text-green-600">Received: {formatDate(request.receivedAt)}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {[request.requestedBy.firstName, request.requestedBy.lastName]
                          .filter(Boolean)
                          .join(" ") || request.requestedBy.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedRequest(request);
                            setNewStatus(request.status);
                            setQuotedAmount(request.quotedAmount?.toString() || "");
                            setShowStatusModal(true);
                            setError("");
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Update
                        </button>
                        {request.uploadedFile && (
                          <a
                            href={request.uploadedFile.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-4 text-green-600 hover:text-green-900 inline-flex items-center gap-1"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            View
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Update Status Modal */}
      {showStatusModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Update Quote Request Status
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Supplier: <span className="font-semibold">{selectedRequest.supplier.name}</span>
              </p>
              {selectedRequest.lead && (
                <p className="text-sm text-gray-600">
                  Lead: <span className="font-semibold">{getLeadName(selectedRequest.lead)}</span>
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="quote_received">Quote Received</option>
                  <option value="accepted">Accepted</option>
                  <option value="declined">Declined</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quoted Amount (£)
                </label>
                <input
                  type="number"
                  value={quotedAmount}
                  onChange={(e) => setQuotedAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            {error && <div className="mt-3 text-red-600 text-sm">{error}</div>}

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateStatus}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update Status
              </button>
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedRequest(null);
                  setNewStatus("");
                  setQuotedAmount("");
                  setError("");
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
