"use client";

import { useEffect, useState } from "react";
import { API_BASE, apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Mail, Phone, MapPin, User, Tag } from "lucide-react";
import { DeskSurface } from "@/components/DeskSurface";
import Link from "next/link";

type Client = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
  notes?: string | null;
  tags?: string[];
  createdAt: string;
  _count?: {
    leads: number;
    opportunities: number;
    quotes: number;
  };
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});

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
    if (!authHeaders["x-tenant-id"]) return;
    loadClients();
  }, [authHeaders]);

  async function loadClients() {
    setLoading(true);
    try {
      const data = await apiFetch<Client[]>("/clients", {
        headers: authHeaders,
      });
      // Sort alphabetically by name
      const sorted = (data || []).sort((a, b) => 
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      );
      setClients(sorted);
    } catch (error) {
      console.error("Failed to load clients:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = clients.filter((client) => {
    const query = searchQuery.toLowerCase();
    return (
      client.name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.phone?.toLowerCase().includes(query) ||
      client.companyName?.toLowerCase().includes(query) ||
      client.city?.toLowerCase().includes(query) ||
      client.postcode?.toLowerCase().includes(query)
    );
  }).sort((a, b) => 
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Clients</h1>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {filteredClients.length} {filteredClients.length === 1 ? 'client' : 'clients'} total
                  </p>
                </div>
              </div>
            </div>

            <Link href="/clients/new">
              <Button 
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Client
              </Button>
            </Link>
          </div>
        </header>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search clients by name, email, phone, company, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-base rounded-2xl border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:shadow-md focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
        </div>

        {/* Clients Grid */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur-sm p-6 shadow-lg animate-pulse"
              >
                <div className="h-6 bg-gradient-to-r from-slate-200 to-slate-100 rounded-xl w-3/4 mb-4" />
                <div className="space-y-3">
                  <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg w-full" />
                  <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg w-5/6" />
                  <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg w-4/6" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-20 rounded-3xl bg-white/60 backdrop-blur-sm border border-slate-200 shadow-lg">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <User className="h-10 w-10 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {searchQuery ? "No clients found" : "No clients yet"}
            </h3>
            <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
              {searchQuery
                ? "Try adjusting your search query to find what you're looking for"
                : "Create your first client to start building relationships and tracking opportunities"}
            </p>
            {!searchQuery && (
              <Link href="/clients/new">
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Client
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredClients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="group rounded-3xl border border-slate-200 bg-white/90 backdrop-blur-sm p-6 shadow-lg hover:shadow-xl hover:border-emerald-300 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/25 group-hover:shadow-xl group-hover:shadow-emerald-500/30 transition-shadow flex-shrink-0">
                      {client.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors text-lg truncate">
                        {client.name}
                      </h3>
                      {client.companyName && (
                        <p className="text-xs text-slate-600 font-medium truncate">{client.companyName}</p>
                      )}
                    </div>
                  </div>
                  {client.tags && client.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap ml-2 flex-shrink-0">
                      {client.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm ${
                            tag === "trade_partner"
                              ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                              : tag === "brochure_enquiry"
                              ? "bg-gradient-to-br from-purple-400 to-pink-500 text-white"
                              : "bg-gradient-to-br from-slate-400 to-slate-500 text-white"
                          }`}
                        >
                          {tag === "trade_partner" ? "Trade" : tag === "brochure_enquiry" ? "Brochure" : tag.slice(0, 3)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 text-sm text-slate-700 mb-4">
                  {client.email && (
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Mail className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="truncate font-medium">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                        <Phone className="h-4 w-4 text-teal-600" />
                      </div>
                      <span className="font-medium">{client.phone}</span>
                    </div>
                  )}
                  {(client.city || client.postcode) && (
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-4 w-4 text-sky-600" />
                      </div>
                      <span className="truncate font-medium">
                        {[client.city, client.postcode].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {client._count && (
                  <div className="mt-4 pt-4 border-t border-slate-200/70 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-2">
                      <div className="text-lg font-bold text-emerald-600">
                        {client._count.leads}
                      </div>
                      <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-wide">Leads</div>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-teal-50 to-sky-50 p-2">
                      <div className="text-lg font-bold text-teal-600">
                        {client._count.opportunities}
                      </div>
                      <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-wide">Orders</div>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 p-2">
                      <div className="text-lg font-bold text-sky-600">
                        {client._count.quotes}
                      </div>
                      <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-wide">Quotes</div>
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
