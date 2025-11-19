"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Code } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface SoftwareProfile {
  id: string;
  name: string;
  displayName: string;
  matchHints: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MatchHints {
  textIncludes?: string[];
  filenameIncludes?: string[];
  emailDomainIncludes?: string[];
}

interface FormData {
  name: string;
  displayName: string;
  matchHints: MatchHints;
}

export default function SoftwareProfilesSection() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<SoftwareProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    displayName: "",
    matchHints: {},
  });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const resp = await apiFetch<{ ok?: boolean; items?: SoftwareProfile[] }>("/software-profiles");
      setProfiles(Array.isArray(resp?.items) ? resp.items : []);
    } catch (err) {
      console.error("Failed to fetch software profiles:", err);
    } finally {
      setLoading(false);
    }
  };

  const parseMatchHints = (json: string | null): MatchHints => {
    if (!json) return {};
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!formData.displayName.trim()) {
      setError("Display name is required");
      return;
    }

    try {
      const url = editingId ? `/software-profiles/${editingId}` : "/software-profiles";
      const method = editingId ? "PATCH" : "POST";

      await apiFetch(url, {
        method,
        json: {
          ...(editingId ? {} : { name: formData.name }),
          displayName: formData.displayName,
          matchHints: formData.matchHints,
        },
      });

      toast({
        title: editingId ? "Profile updated" : "Profile created",
        description: editingId
          ? "Software profile updated successfully"
          : "Software profile created successfully",
      });

      setShowForm(false);
      setEditingId(null);
      setFormData({ name: "", displayName: "", matchHints: {} });
      fetchProfiles();
    } catch (err: any) {
      setError(err?.message || "Failed to save profile");
    }
  };

  const handleEdit = (profile: SoftwareProfile) => {
    setEditingId(profile.id);
    setFormData({
      name: profile.name,
      displayName: profile.displayName,
      matchHints: parseMatchHints(profile.matchHints),
    });
    setShowForm(true);
    setError("");
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete profile "${name}"? This cannot be undone.`)) return;

    try {
      await apiFetch(`/software-profiles/${id}`, { method: "DELETE" });
      toast({ title: "Profile deleted", description: "Software profile deleted successfully" });
      fetchProfiles();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.message || "Failed to delete profile",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: "", displayName: "", matchHints: {} });
    setError("");
  };

  const updateMatchHintArray = (
    key: keyof MatchHints,
    index: number,
    value: string | null
  ) => {
    setFormData((prev) => {
      const array = (prev.matchHints[key] || []) as string[];
      if (value === null) {
        // Remove
        return {
          ...prev,
          matchHints: {
            ...prev.matchHints,
            [key]: array.filter((_, i) => i !== index),
          },
        };
      }
      // Update
      const newArray = [...array];
      newArray[index] = value;
      return {
        ...prev,
        matchHints: {
          ...prev.matchHints,
          [key]: newArray,
        },
      };
    });
  };

  const addMatchHintItem = (key: keyof MatchHints) => {
    setFormData((prev) => ({
      ...prev,
      matchHints: {
        ...prev.matchHints,
        [key]: [...(prev.matchHints[key] || []), ""],
      },
    }));
  };

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading software profiles...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-600">
          Define software systems (like JoinerySoft, Estimate Pro, etc.) that generate quotes.
          These profiles help the parser recognize and extract data from different software layouts.
        </p>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Profile
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">
            {editingId ? "Edit Software Profile" : "Add Software Profile"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Internal Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="joinerysoft_v1"
                  disabled={!!editingId}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editingId ? "Cannot change after creation" : "Lowercase, alphanumeric, underscores only"}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="JoinerySoft (version 1)"
                  required
                />
              </div>
            </div>

            {/* Match Hints */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Match Hints (optional)</h4>
              <p className="text-xs text-gray-500">
                Help the system auto-detect this software by specifying text patterns, filename keywords, or email domains
              </p>

              {/* Text Includes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Text patterns (words found in PDFs)
                </label>
                {(formData.matchHints.textIncludes || []).map((hint, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={hint}
                      onChange={(e) => updateMatchHintArray("textIncludes", idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm border rounded-lg"
                      placeholder="JoinerySoft, JOINERYSOFT"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => updateMatchHintArray("textIncludes", idx, null)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addMatchHintItem("textIncludes")}
                >
                  Add Text Pattern
                </Button>
              </div>

              {/* Filename Includes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Filename keywords
                </label>
                {(formData.matchHints.filenameIncludes || []).map((hint, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={hint}
                      onChange={(e) => updateMatchHintArray("filenameIncludes", idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm border rounded-lg"
                      placeholder="joinerysoft, jsquote"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => updateMatchHintArray("filenameIncludes", idx, null)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addMatchHintItem("filenameIncludes")}
                >
                  Add Filename Keyword
                </Button>
              </div>

              {/* Email Domain Includes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Email domains
                </label>
                {(formData.matchHints.emailDomainIncludes || []).map((hint, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={hint}
                      onChange={(e) => updateMatchHintArray("emailDomainIncludes", idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm border rounded-lg"
                      placeholder="joinerysoft.com"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => updateMatchHintArray("emailDomainIncludes", idx, null)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addMatchHintItem("emailDomainIncludes")}
                >
                  Add Email Domain
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" size="sm">
                {editingId ? "Update Profile" : "Create Profile"}
              </Button>
              <Button type="button" onClick={handleCancel} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {profiles.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            <Code className="w-10 h-10 mx-auto mb-2 text-gray-400" />
            <p>No software profiles yet. Click "Add Profile" to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Display Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Match Hints
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {profiles.map((profile) => {
                  const hints = parseMatchHints(profile.matchHints);
                  const hintCount =
                    (hints.textIncludes?.length || 0) +
                    (hints.filenameIncludes?.length || 0) +
                    (hints.emailDomainIncludes?.length || 0);

                  return (
                    <tr key={profile.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-gray-700">{profile.name}</td>
                      <td className="px-4 py-3 text-gray-900">{profile.displayName}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {hintCount === 0 ? (
                          <span className="text-gray-400">No hints</span>
                        ) : (
                          <span>{hintCount} hint{hintCount !== 1 ? "s" : ""}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleEdit(profile)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          title="Edit profile"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(profile.id, profile.displayName)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
