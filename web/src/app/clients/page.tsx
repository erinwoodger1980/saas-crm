"use client";

import { useEffect, useState } from "react";
import { API_BASE, apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Mail, Phone, MapPin, User } from "lucide-react";
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
      setClients(data || []);
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
  });

  return (
    <DeskSurface>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-white/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-500 shadow-sm"
              title="Manage your clients and see their quotes, orders, and projects"
            >
              <span aria-hidden="true">👥</span>
              Clients
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/clients/new">
              <Button variant="default" type="button">
                <Plus className="h-4 w-4 mr-2" />
                New Client
              </Button>
            </Link>
          </div>
        </header>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search clients by name, email, phone, company, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Clients Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm animate-pulse"
              >
                <div className="h-6 bg-slate-200 rounded w-3/4 mb-4" />
                <div className="space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-full" />
                  <div className="h-4 bg-slate-200 rounded w-5/6" />
                  <div className="h-4 bg-slate-200 rounded w-4/6" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {searchQuery ? "No clients found" : "No clients yet"}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {searchQuery
                ? "Try adjusting your search query"
                : "Create your first client to get started"}
            </p>
            {!searchQuery && (
              <Link href="/clients/new">
                <Button variant="default">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Client
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredClients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="group rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-lg">
                      {client.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 group-hover:text-sky-600 transition-colors">
                        {client.name}
                      </h3>
                      {client.companyName && (
                        <p className="text-xs text-slate-500">{client.companyName}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {(client.city || client.postcode) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span className="truncate">
                        {[client.city, client.postcode].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {client._count && (
                  <div className="mt-4 pt-4 border-t border-slate-200 flex gap-4 text-xs text-slate-500">
                    <div>
                      <span className="font-semibold text-slate-700">
                        {client._count.leads}
                      </span>{" "}
                      leads
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">
                        {client._count.opportunities}
                      </span>{" "}
                      opportunities
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">
                        {client._count.quotes}
                      </span>{" "}
                      quotes
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </DeskSurface>
  );
}
