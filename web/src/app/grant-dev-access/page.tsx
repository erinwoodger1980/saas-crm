"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function GrantDevAccessPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function grantDeveloperAccess() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await apiFetch<{ success: boolean; message: string; user: any }>("/auth/make-me-developer", {
        method: "POST",
      });
      setMessage(response.message);
      // Reload after 2 seconds
      setTimeout(() => window.location.href = "/dev", 2000);
    } catch (e: any) {
      setError(e?.message || "Failed to grant developer access");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Grant Developer Access</h1>
          <p className="text-sm text-slate-600 mt-2">
            Click the button below to mark your account as a developer. This will grant you access to:
          </p>
          <ul className="list-disc list-inside text-sm text-slate-600 mt-2 space-y-1">
            <li>ML training samples dashboard</li>
            <li>Cross-tenant tools</li>
            <li>Developer console features</li>
          </ul>
        </div>

        {message && (
          <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <Button
          onClick={grantDeveloperAccess}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Granting access..." : "Grant Developer Access"}
        </Button>

        <p className="text-xs text-slate-500 text-center">
          After granting access, you'll be redirected to the developer console.
        </p>
      </Card>
    </div>
  );
}
