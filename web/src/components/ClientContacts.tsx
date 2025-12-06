"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, X, Check, Mail, Phone, Star } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type ClientContact = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  position?: string | null;
  isPrimary: boolean;
  notes?: string | null;
};

type ClientContactsProps = {
  clientId: string;
  contacts: ClientContact[];
  onRefresh: () => void;
  onAddContact: (data: Omit<ClientContact, "id">) => Promise<void>;
  onUpdateContact: (contactId: string, data: Partial<ClientContact>) => Promise<void>;
  onDeleteContact: (contactId: string) => Promise<void>;
};

export function ClientContacts({
  clientId,
  contacts,
  onRefresh,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
}: ClientContactsProps) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    mobile: "",
    position: "",
    isPrimary: false,
    notes: "",
  });

  function resetForm() {
    setFormData({
      name: "",
      email: "",
      phone: "",
      mobile: "",
      position: "",
      isPrimary: false,
      notes: "",
    });
    setShowAddForm(false);
    setEditingId(null);
  }

  function startEdit(contact: ClientContact) {
    setFormData({
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      mobile: contact.mobile || "",
      position: contact.position || "",
      isPrimary: contact.isPrimary,
      notes: contact.notes || "",
    });
    setEditingId(contact.id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Contact name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingId) {
        await onUpdateContact(editingId, formData);
        toast({
          title: "Success",
          description: "Contact updated successfully",
        });
      } else {
        await onAddContact(formData as Omit<ClientContact, "id">);
        toast({
          title: "Success",
          description: "Contact added successfully",
        });
      }
      resetForm();
      onRefresh();
    } catch (error) {
      console.error("Failed to save contact:", error);
      toast({
        title: "Error",
        description: `Failed to ${editingId ? "update" : "add"} contact`,
        variant: "destructive",
      });
    }
  }

  async function handleDelete(contactId: string) {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      await onDeleteContact(contactId);
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
      onRefresh();
    } catch (error) {
      console.error("Failed to delete contact:", error);
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Contacts List */}
      {contacts.length === 0 && !showAddForm && (
        <div className="text-center py-8 text-sm text-slate-500">
          No contacts added yet
        </div>
      )}

      {contacts.map((contact) => (
        <div
          key={contact.id}
          className={`rounded-xl border ${
            contact.isPrimary ? "border-sky-300 bg-sky-50/50" : "border-slate-200 bg-white"
          } p-4`}
        >
          {editingId === contact.id ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Name *"
                  required
                />
                <Input
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Position"
                />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Email"
                />
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Phone"
                />
                <Input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="Mobile"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.isPrimary}
                    onChange={(e) =>
                      setFormData({ ...formData, isPrimary: e.target.checked })
                    }
                  />
                  Primary Contact
                </label>
              </div>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes"
                rows={2}
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  <Check className="h-4 w-4 mr-1" />
                  Save
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-slate-900">{contact.name}</h4>
                  {contact.isPrimary && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                      <Star className="h-3 w-3 fill-current" />
                      Primary
                    </span>
                  )}
                </div>
                {contact.position && (
                  <p className="text-sm text-slate-600">{contact.position}</p>
                )}
                <div className="space-y-1">
                  {contact.email && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <a href={`mailto:${contact.email}`} className="hover:text-sky-600">
                        {contact.email}
                      </a>
                    </div>
                  )}
                  {(contact.phone || contact.mobile) && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <a
                        href={`tel:${contact.mobile || contact.phone}`}
                        className="hover:text-sky-600"
                      >
                        {contact.mobile || contact.phone}
                      </a>
                    </div>
                  )}
                </div>
                {contact.notes && (
                  <p className="text-sm text-slate-500 whitespace-pre-wrap">
                    {contact.notes}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(contact)}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(contact.id)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add Contact Form */}
      {showAddForm ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Name *"
                required
                autoFocus
              />
              <Input
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="Position"
              />
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Email"
              />
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone"
              />
              <Input
                type="tel"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="Mobile"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.isPrimary}
                  onChange={(e) =>
                    setFormData({ ...formData, isPrimary: e.target.checked })
                  }
                />
                Primary Contact
              </label>
            </div>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notes"
              rows={2}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                <Check className="h-4 w-4 mr-1" />
                Add Contact
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      )}
    </div>
  );
}
