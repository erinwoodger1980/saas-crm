"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
}

interface SupplierFormData {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

export default function SuppliersSection() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [formData, setFormData] = useState<SupplierFormData>({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const resp = await apiFetch<{ ok?: boolean; items?: Supplier[] }>("/suppliers");
      const list = Array.isArray(resp?.items) ? resp.items : [];
      setSuppliers(list);
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.name.trim()) {
      setError("Supplier name is required");
      return;
    }

    try {
      const url = editingId ? `/suppliers/${editingId}` : "/suppliers";
      const method = editingId ? "PATCH" : "POST";

      await apiFetch(url, {
        method,
        json: formData,
      });

      setSuccess(editingId ? "Supplier updated successfully" : "Supplier created successfully");
      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      });
      fetchSuppliers();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to save supplier");
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
    });
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const supplier = suppliers.find((s) => s.id === deletingId);
    if (!supplier || confirmEmail !== supplier.email) {
      setError("Email does not match");
      return;
    }

    try {
      await apiFetch(`/suppliers/${deletingId}`, {
        method: "DELETE",
      });

      setSuccess("Supplier deleted successfully");
      setDeletingId(null);
      setConfirmEmail("");
      fetchSuppliers();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to delete supplier");
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
    });
    setError("");
  };

  if (loading) {
    return (
      <div className="text-gray-500">Loading suppliers...</div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      {showForm && (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">
            {editingId ? "Edit Supplier" : "Add New Supplier"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="ABC Supplies Ltd"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John Smith"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contact@abcsupplies.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+44 1234 567890"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="123 Supply Street, London, UK"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Additional notes about this supplier..."
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" size="sm">
                {editingId ? "Update Supplier" : "Create Supplier"}
              </Button>
              <Button
                type="button"
                onClick={handleCancel}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {suppliers.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-400" />
            <p>No suppliers yet. Click "Add Supplier" to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{supplier.name}</div>
                      {supplier.address && (
                        <div className="text-xs text-gray-500">{supplier.address}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {supplier.contactPerson || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {supplier.email || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {supplier.phone || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleEdit(supplier)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        title="Edit supplier"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDeletingId(supplier.id);
                          setConfirmEmail("");
                          setError("");
                        }}
                        className="text-red-600 hover:text-red-900"
                        title="Delete supplier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Delete Supplier</h3>
            <p className="text-gray-600 mb-4 text-sm">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {suppliers.find((s) => s.id === deletingId)?.name}
              </span>
              ? This action cannot be undone.
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Type the supplier&apos;s email to confirm:{" "}
              <span className="font-mono font-semibold">
                {suppliers.find((s) => s.id === deletingId)?.email || "(no email)"}
              </span>
            </p>
            <input
              type="text"
              value={confirmEmail}
              onChange={(e) => {
                setConfirmEmail(e.target.value);
                setError("");
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-3"
              placeholder="Enter email to confirm"
            />
            {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
            <div className="flex gap-3">
              <Button
                onClick={handleDelete}
                variant="destructive"
                size="sm"
                className="flex-1"
              >
                Delete Supplier
              </Button>
              <Button
                onClick={() => {
                  setDeletingId(null);
                  setConfirmEmail("");
                  setError("");
                }}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
