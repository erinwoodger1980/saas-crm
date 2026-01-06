"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_BASE, apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DeskSurface } from "@/components/DeskSurface";
import SectionCard from "@/components/SectionCard";
import { ClientContacts } from "@/components/ClientContacts";
import { ClientPortalAccess } from "@/components/ClientPortalAccess";
import { FieldForm } from "@/components/fields/FieldRenderer";
import { useFields } from "@/hooks/useFields";
import { ArrowLeft, Save, Mail, Phone, MapPin, Building, Edit, Check, X } from "lucide-react";
import Link from "next/link";
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

type Client = {
  id: string;
  name: string;
  type?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  contactPerson?: string | null;
  country?: string | null;
  companyName?: string | null;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
  notes?: string | null;
  tags?: string[];
  createdAt: string;
  contacts?: ClientContact[];
};

type Lead = {
  id: string;
  number?: string | null;
  contactName?: string | null;
  status: string;
  estimatedValue?: number | null;
  capturedAt: string;
};

type Opportunity = {
  id: string;
  leadId: string;
  lead: {
    contactName?: string | null;
  };
  stage: string;
  valueGBP?: number | null;
  createdAt: string;
};

type Quote = {
  id: string;
  leadId: string;
  lead: {
    contactName?: string | null;
  };
  stage: string;
  valueGBP?: number | null;
  createdAt: string;
};

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const clientId = params?.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [savingFields, setSavingFields] = useState(false);

  const { fields, isLoading: fieldsLoading } = useFields({
    scope: "client",
    context: "client_detail",
  });

  const [formData, setFormData] = useState({
    name: "",
    type: "public" as string,
    email: "",
    phone: "",
    companyName: "",
    address: "",
    city: "",
    postcode: "",
    notes: "",
    tags: [] as string[],
  });

  useEffect(() => {
    const auth = getAuthIdsFromJwt();
    if (auth) {
      setAuthHeaders({
        "x-user-id": auth.userId,
        "x-tenant-id": auth.tenantId,
      });
    }
  }, []);

  useEffect(() => {
    if (!authHeaders["x-tenant-id"] || !clientId) return;
    loadClient();
    loadRelatedData();
  }, [authHeaders, clientId]);

  async function loadClient() {
    setLoading(true);
    try {
      const data = await apiFetch<Client>(`/clients/${clientId}`, {
        headers: authHeaders,
      });
      setClient(data);
      setFormData({
        name: data.name || "",
        type: (data as any).type || "public",
        email: data.email || "",
        phone: data.phone || "",
        companyName: data.companyName || "",
        address: data.address || "",
        city: data.city || "",
        postcode: data.postcode || "",
        notes: data.notes || "",
        tags: data.tags || [],
      });
      
      // Load custom field values
      const customData = (data as any).custom || {};
      setCustomFieldValues(customData);
    } catch (error) {
      console.error("Failed to load client:", error);
      toast({
        title: "Error",
        description: "Failed to load client details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCustomFields() {
    if (!client) return;
    setSavingFields(true);
    try {
      await apiFetch(`/clients/${clientId}`, {
        method: "PATCH",
        headers: authHeaders,
        json: {
          custom: customFieldValues,
        },
      });
      toast({
        title: "Success",
        description: "Custom fields saved successfully",
      });
    } catch (error) {
      console.error("Failed to save custom fields:", error);
      toast({
        title: "Error",
        description: "Failed to save custom fields",
        variant: "destructive",
      });
    } finally {
      setSavingFields(false);
    }
  }

  async function loadRelatedData() {
    try {
      const [leadsData, oppsData, quotesData] = await Promise.all([
        apiFetch<Lead[]>(`/clients/${clientId}/leads`, { headers: authHeaders }),
        apiFetch<Opportunity[]>(`/clients/${clientId}/opportunities`, { headers: authHeaders }),
        apiFetch<Quote[]>(`/clients/${clientId}/quotes`, { headers: authHeaders }),
      ]);
      setLeads(leadsData || []);
      setOpportunities(oppsData || []);
      setQuotes(quotesData || []);
    } catch (error) {
      console.error("Failed to load related data:", error);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch(`/clients/${clientId}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      toast({
        title: "Success",
        description: "Client details updated successfully",
      });
      
      setEditing(false);
      loadClient();
    } catch (error) {
      console.error("Failed to save client:", error);
      toast({
        title: "Error",
        description: "Failed to update client details",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DeskSurface>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-1/4" />
          <div className="h-64 bg-slate-200 rounded" />
        </div>
      </DeskSurface>
    );
  }

  if (!client) {
    return (
      <DeskSurface>
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Client not found</h3>
          <Link href="/clients">
            <Button variant="outline">Back to Clients</Button>
          </Link>
        </div>
      </DeskSurface>
    );
  }

  return (
    <DeskSurface>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/clients">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
              {client.companyName && (
                <p className="text-sm text-slate-500">{client.companyName}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {editing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setFormData({
                      name: client.name || "",
                      type: (client as any).type || "public",
                      email: client.email || "",
                      phone: client.phone || "",
                      companyName: client.companyName || "",
                      address: client.address || "",
                      city: client.city || "",
                      postcode: client.postcode || "",
                      notes: client.notes || "",
                      tags: client.tags || [],
                    });
                  }}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Check className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Details
              </Button>
            )}
          </div>
        </header>

        {/* Client Details */}
        <SectionCard title="Contact Information">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Name *
              </label>
              {editing ? (
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              ) : (
                <p className="text-slate-900">{client.name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Client Type
              </label>
              {editing ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full border ${formData.type === "public" ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-700 border-slate-300"}`}
                    onClick={() => setFormData({ ...formData, type: "public" })}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full border ${formData.type === "trade" ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-700 border-slate-300"}`}
                    onClick={() => setFormData({ ...formData, type: "trade" })}
                  >
                    Trade
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full border ${formData.type === "reseller" ? "bg-purple-600 text-white border-purple-600" : "bg-white text-slate-700 border-slate-300"}`}
                    onClick={() => setFormData({ ...formData, type: "reseller" })}
                  >
                    Reseller
                  </button>
                </div>
              ) : (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${client.type === "trade" ? "bg-amber-100 text-amber-700 border border-amber-200" : client.type === "reseller" ? "bg-purple-100 text-purple-700 border border-purple-200" : "bg-sky-100 text-sky-700 border border-sky-200"}`}>
                  {client.type === "trade" ? "Trade" : client.type === "reseller" ? "Reseller" : "Public"}
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Company Name
              </label>
              {editing ? (
                <Input
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                />
              ) : (
                <p className="text-slate-900">{client.companyName || "—"}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Mail className="inline h-4 w-4 mr-1" />
                Email
              </label>
              {editing ? (
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              ) : (
                <p className="text-slate-900">{client.email || "—"}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Phone className="inline h-4 w-4 mr-1" />
                Phone
              </label>
              {editing ? (
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="01234 567890 or 07123 456789"
                />
              ) : (
                <p className="text-slate-900">{client.phone || "—"}</p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Contacts */}
        <SectionCard title="Contacts">
          <ClientContacts
            clientId={clientId}
            contacts={client.contacts || []}
            onRefresh={loadClient}
            onAddContact={async (data) => {
              await apiFetch(`/clients/${clientId}/contacts`, {
                method: "POST",
                headers: authHeaders,
                json: data,
              });
            }}
            onUpdateContact={async (contactId, data) => {
              await apiFetch(`/clients/${clientId}/contacts/${contactId}`, {
                method: "PATCH",
                headers: authHeaders,
                json: data,
              });
            }}
            onDeleteContact={async (contactId) => {
              await apiFetch(`/clients/${clientId}/contacts/${contactId}`, {
                method: "DELETE",
                headers: authHeaders,
              });
            }}
          />
        </SectionCard>

        {/* Customer Portal Access */}
        <SectionCard title="Customer Portal">
          <ClientPortalAccess
            clientId={clientId}
            authHeaders={authHeaders}
          />
        </SectionCard>

        {/* Address */}
        <SectionCard title="Address">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <MapPin className="inline h-4 w-4 mr-1" />
                Street Address
              </label>
              {editing ? (
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              ) : (
                <p className="text-slate-900">{client.address || "—"}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
              {editing ? (
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              ) : (
                <p className="text-slate-900">{client.city || "—"}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Postcode
              </label>
              {editing ? (
                <Input
                  value={formData.postcode}
                  onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                />
              ) : (
                <p className="text-slate-900">{client.postcode || "—"}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              {editing ? (
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                />
              ) : (
                <p className="text-slate-900 whitespace-pre-wrap">
                  {client.notes || "—"}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Tags</label>
              {editing ? (
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={formData.tags.includes("trade_partner")}
                      onChange={(e) => {
                        const newTags = e.target.checked
                          ? [...formData.tags, "trade_partner"]
                          : formData.tags.filter(t => t !== "trade_partner");
                        setFormData({ ...formData, tags: newTags });
                      }}
                    />
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                      Trade Partner
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={formData.tags.includes("brochure_enquiry")}
                      onChange={(e) => {
                        const newTags = e.target.checked
                          ? [...formData.tags, "brochure_enquiry"]
                          : formData.tags.filter(t => t !== "brochure_enquiry");
                        setFormData({ ...formData, tags: newTags });
                      }}
                    />
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                      Brochure Enquiry
                    </span>
                  </label>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {client.tags && client.tags.length > 0 ? (
                    client.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          tag === "trade_partner"
                            ? "bg-amber-100 text-amber-700 border border-amber-200"
                            : tag === "brochure_enquiry"
                            ? "bg-purple-100 text-purple-700 border border-purple-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {tag === "trade_partner" ? "Trade Partner" : tag === "brochure_enquiry" ? "Brochure Enquiry" : tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-900">—</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Custom Fields */}
        {!fieldsLoading && fields.length > 0 && (
          <SectionCard title="Custom Fields">
            <FieldForm
              fields={fields as any}
              values={customFieldValues}
              onChange={setCustomFieldValues}
              disabled={!editing}
            />
            {editing && (
              <div className="mt-4 flex gap-2 justify-end border-t border-slate-200 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCustomFieldValues((client as any).custom || {})}
                  disabled={savingFields}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveCustomFields}
                  disabled={savingFields}
                >
                  {savingFields ? "Saving..." : "Save Fields"}
                </Button>
              </div>
            )}
          </SectionCard>
        )}

        {/* Leads */}
        <SectionCard title={`Leads (${leads.length})`}>
          {leads.length === 0 ? (
            <p className="text-sm text-slate-500">No leads found for this client</p>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads?id=${lead.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {lead.number || `Lead #${lead.id.slice(0, 8)}`}
                    </p>
                    <p className="text-sm text-slate-500">{lead.contactName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700">{lead.status}</p>
                    {lead.estimatedValue && (
                      <p className="text-sm text-slate-500">
                        £{lead.estimatedValue.toFixed(2)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Quotes & Orders */}
        <SectionCard title={`Quotes & Orders (${opportunities.length})`}>
          {opportunities.length === 0 ? (
            <p className="text-sm text-slate-500">No quotes or orders found for this client</p>
          ) : (
            <div className="space-y-2">
              {opportunities.map((opp) => (
                <Link
                  key={opp.id}
                  href={`/opportunities?id=${opp.leadId}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {opp.lead.contactName || `Quote #${opp.id.slice(0, 8)}`}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(opp.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700">{opp.stage}</p>
                    {opp.valueGBP && (
                      <p className="text-sm text-slate-500">£{Number(opp.valueGBP).toFixed(2)}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Quotes */}
        <SectionCard title={`Quotes (${quotes.length})`}>
          {quotes.length === 0 ? (
            <p className="text-sm text-slate-500">No quotes found for this client</p>
          ) : (
            <div className="space-y-2">
              {quotes.map((quote) => (
                <Link
                  key={quote.id}
                  href={`/quotes/${quote.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      Quote #{quote.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(quote.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700">{quote.stage}</p>
                    {quote.valueGBP && (
                      <p className="text-sm text-slate-500">
                        £{Number(quote.valueGBP).toFixed(2)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </DeskSurface>
  );
}
