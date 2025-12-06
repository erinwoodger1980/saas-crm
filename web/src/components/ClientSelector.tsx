"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Check, X, Search, ExternalLink } from "lucide-react";
import Link from "next/link";

type Client = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  city?: string | null;
};

type ClientSelectorProps = {
  currentClientId?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  onSelect: (clientId: string | null) => void;
  onCreateNew?: (data: { name: string; email: string; phone?: string }) => Promise<string>;
};

export function ClientSelector({
  currentClientId,
  contactEmail,
  contactName,
  onSelect,
  onCreateNew,
}: ClientSelectorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [suggestedClient, setSuggestedClient] = useState<Client | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    // Auto-populate new client form with contact info
    if (contactName) setNewClientName(contactName);
    if (contactEmail) setNewClientEmail(contactEmail);
  }, [contactName, contactEmail]);

  useEffect(() => {
    // Find current client
    if (currentClientId && clients.length > 0) {
      const client = clients.find((c) => c.id === currentClientId);
      if (client) setSelectedClient(client);
    }
  }, [currentClientId, clients]);

  useEffect(() => {
    // Auto-suggest client based on email
    if (contactEmail && clients.length > 0 && !currentClientId) {
      const suggested = clients.find(
        (c) => c.email?.toLowerCase() === contactEmail.toLowerCase()
      );
      if (suggested) {
        setSuggestedClient(suggested);
      }
    }
  }, [contactEmail, clients, currentClientId]);

  async function loadClients() {
    setLoading(true);
    try {
      const data = await apiFetch<Client[]>("/clients");
      setClients(data || []);
    } catch (error) {
      console.error("Failed to load clients:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateNew() {
    if (!newClientName.trim()) return;

    try {
      if (onCreateNew) {
        const newClientId = await onCreateNew({
          name: newClientName.trim(),
          email: newClientEmail.trim() || "",
        });
        await loadClients();
        onSelect(newClientId);
        setCreatingNew(false);
        setNewClientName("");
        setNewClientEmail("");
      }
    } catch (error) {
      console.error("Failed to create client:", error);
    }
  }

  function handleSelectClient(client: Client) {
    setSelectedClient(client);
    onSelect(client.id);
    setShowDropdown(false);
    setSuggestedClient(null);
  }

  function handleUnlink() {
    setSelectedClient(null);
    onSelect(null);
  }

  function handleAcceptSuggestion() {
    if (suggestedClient) {
      handleSelectClient(suggestedClient);
    }
  }

  const filteredClients = clients.filter((client) => {
    const query = searchQuery.toLowerCase();
    return (
      client.name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.companyName?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-3">
      {/* Suggestion Banner */}
      {suggestedClient && !selectedClient && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-sm font-medium text-sky-900">
                Suggested client match
              </div>
              <div className="mt-1 text-xs text-sky-700">
                {suggestedClient.name}
                {suggestedClient.email && ` (${suggestedClient.email})`}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleAcceptSuggestion}
                className="h-7 text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Link
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSuggestedClient(null)}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Client Display */}
      {selectedClient && (
        <div className="rounded-xl border border-slate-200 bg-white/90 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white font-semibold">
                {selectedClient.name?.charAt(0).toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 truncate">
                  {selectedClient.name}
                </div>
                {selectedClient.email && (
                  <div className="text-xs text-slate-500 truncate">
                    {selectedClient.email}
                  </div>
                )}
                {selectedClient.companyName && (
                  <div className="text-xs text-slate-500 truncate">
                    {selectedClient.companyName}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/clients/${selectedClient.id}`} target="_blank">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleUnlink}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Client Selector */}
      {!selectedClient && (
        <>
          <div className="relative">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <Users className="h-4 w-4 mr-2" />
              Link to Client
            </Button>

            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                {/* Search */}
                <div className="p-3 border-b border-slate-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search clients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Client List */}
                <div className="max-h-64 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-sm text-slate-500 text-center">
                      Loading clients...
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500 text-center">
                      No clients found
                    </div>
                  ) : (
                    filteredClients.map((client) => (
                      <button
                        key={client.id}
                        className="w-full p-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                        onClick={() => handleSelectClient(client)}
                      >
                        <div className="font-medium text-slate-900">
                          {client.name}
                        </div>
                        {client.email && (
                          <div className="text-xs text-slate-500">{client.email}</div>
                        )}
                        {client.companyName && (
                          <div className="text-xs text-slate-500">
                            {client.companyName}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>

                {/* Create New */}
                <div className="p-3 border-t border-slate-200 bg-slate-50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setCreatingNew(true);
                      setShowDropdown(false);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Client
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Create New Client Modal */}
      {creatingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Create New Client
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCreatingNew(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <label className="block text-sm">
                <span className="block text-xs font-semibold text-slate-700 mb-1">
                  Name *
                </span>
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Client name"
                />
              </label>

              <label className="block text-sm">
                <span className="block text-xs font-semibold text-slate-700 mb-1">
                  Email
                </span>
                <Input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="client@email.com"
                />
              </label>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreatingNew(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateNew}
                disabled={!newClientName.trim()}
              >
                Create Client
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
