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
import { ArrowLeft, Save, Mail, Phone, MapPin, Building, Edit, Check, X } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";

type Client = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  companyName?: string | null;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
  notes?: string | null;
  createdAt: string;
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

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    address: "",
    city: "",
    postcode: "",
    notes: "",
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
        email: data.email || "",
        phone: data.phone || "",
        companyName: data.companyName || "",
        address: data.address || "",
        city: data.city || "",
        postcode: data.postcode || "",
        notes: data.notes || "",
      });
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
                      email: client.email || "",
                      phone: client.phone || "",
                      companyName: client.companyName || "",
                      address: client.address || "",
                      city: client.city || "",
                      postcode: client.postcode || "",
                      notes: client.notes || "",
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
          </div>
        </SectionCard>

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

        {/* Opportunities */}
        <SectionCard title={`Opportunities (${opportunities.length})`}>
          {opportunities.length === 0 ? (
            <p className="text-sm text-slate-500">No opportunities found for this client</p>
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
                      {opp.lead.contactName || `Opportunity #${opp.id.slice(0, 8)}`}
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
