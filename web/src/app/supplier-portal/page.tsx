"use client";

import { useState, useEffect } from "react";
import { Package, Upload, Clock, CheckCircle, FileText, Building2 } from "lucide-react";

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
  tenant: {
    id: string;
    name: string;
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
  declined: Clock,
};

const statusLabels = {
  pending: "Awaiting Quote",
  quote_received: "Quote Submitted",
  accepted: "Accepted",
  declined: "Declined",
};

export default function SupplierPortalPage() {
  const [requests, setRequests] = useState<SupplierQuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<SupplierQuoteRequest | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [quotedAmount, setQuotedAmount] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    // Get user email from localStorage or JWT
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserEmail(payload.email || "");
      } catch (err) {
        console.error("Failed to parse token:", err);
      }
    }
  }, []);

  useEffect(() => {
    if (userEmail) {
      fetchRequests();
    }
  }, [userEmail]);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/supplier-quote-requests/by-supplier-email/${encodeURIComponent(userEmail)}`, {
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

  const handleSubmitQuote = async () => {
    if (!selectedRequest) return;

    if (!quotedAmount || parseFloat(quotedAmount) <= 0) {
      setError("Please enter a valid quoted amount");
      return;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem("token");

      const res = await fetch(`/api/supplier-quote-requests/${selectedRequest.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "quote_received",
          quotedAmount: parseFloat(quotedAmount),
        }),
      });

      if (res.ok) {
        setSuccess("Quote submitted successfully");
        setShowUploadModal(false);
        setSelectedRequest(null);
        setQuotedAmount("");
        fetchRequests();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to submit quote");
      }
    } catch (err) {
      setError("Failed to submit quote");
    } finally {
      setUploading(false);
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
    });
  };

  const getLeadName = (lead: SupplierQuoteRequest["lead"]) => {
    if (!lead) return "—";
    if (lead.companyName) return lead.companyName;
    return [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unnamed Lead";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading your quote requests...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Supplier Portal</h1>
                <p className="text-sm text-gray-600">{userEmail}</p>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{requests.length}</span> quote request
              {requests.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
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

        {requests.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Quote Requests</h2>
            <p className="text-gray-600">
              You don't have any quote requests at the moment.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {requests.map((request) => {
              const StatusIcon = statusIcons[request.status as keyof typeof statusIcons] || Clock;
              const isPending = request.status === "pending";

              return (
                <div
                  key={request.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="w-5 h-5 text-gray-400" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            {request.tenant.name}
                          </h3>
                        </div>
                        {request.lead && (
                          <p className="text-gray-700 mb-1">
                            Project for: <span className="font-medium">{getLeadName(request.lead)}</span>
                          </p>
                        )}
                        {request.opportunity && (
                          <p className="text-sm text-gray-600">
                            Opportunity: {request.opportunity.title || "Untitled"}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
                          statusColors[request.status as keyof typeof statusColors] || statusColors.pending
                        }`}
                      >
                        <StatusIcon className="w-4 h-4" />
                        {statusLabels[request.status as keyof typeof statusLabels] || request.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-gray-500">Requested:</span>
                        <span className="ml-2 font-medium text-gray-900">{formatDate(request.sentAt)}</span>
                      </div>
                      {request.receivedAt && (
                        <div>
                          <span className="text-gray-500">Submitted:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {formatDate(request.receivedAt)}
                          </span>
                        </div>
                      )}
                      {request.quotedAmount && (
                        <div>
                          <span className="text-gray-500">Quote Amount:</span>
                          <span className="ml-2 font-semibold text-green-600">
                            {formatCurrency(request.quotedAmount)}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Requested by:</span>
                        <span className="ml-2 text-gray-900">
                          {[request.requestedBy.firstName, request.requestedBy.lastName]
                            .filter(Boolean)
                            .join(" ") || request.requestedBy.email}
                        </span>
                      </div>
                    </div>

                    {request.notes && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">{request.notes}</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      {isPending && (
                        <button
                          onClick={() => {
                            setSelectedRequest(request);
                            setQuotedAmount("");
                            setShowUploadModal(true);
                            setError("");
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Submit Quote
                        </button>
                      )}
                      {request.uploadedFile && (
                        <a
                          href={request.uploadedFile.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          View Quote Document
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submit Quote Modal */}
      {showUploadModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Submit Quote</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Company: <span className="font-semibold">{selectedRequest.tenant.name}</span>
              </p>
              {selectedRequest.lead && (
                <p className="text-sm text-gray-600">
                  Project: <span className="font-semibold">{getLeadName(selectedRequest.lead)}</span>
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quoted Amount (£) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={quotedAmount}
                  onChange={(e) => {
                    setQuotedAmount(e.target.value);
                    setError("");
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> After submitting, the customer will be notified of your quote.
                </p>
              </div>
            </div>

            {error && <div className="mt-3 text-red-600 text-sm">{error}</div>}

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmitQuote}
                disabled={uploading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Submitting..." : "Submit Quote"}
              </button>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedRequest(null);
                  setQuotedAmount("");
                  setError("");
                }}
                disabled={uploading}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
