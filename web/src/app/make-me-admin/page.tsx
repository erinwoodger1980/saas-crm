"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function MakeMeAdminPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleMakeAdmin = async () => {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await apiFetch<any>("/auth/make-me-admin", {
        method: "POST",
      });
      
      setMessage(response.message || "You are now an admin! Refresh the page.");
      
      // Refresh after 2 seconds
      setTimeout(() => {
        window.location.href = "/admin/dev-console";
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "Failed to grant admin access");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-4">Grant Admin Access</h1>
        <p className="text-gray-600 mb-6">
          Click the button below to grant yourself admin access. You'll be redirected to the developer console.
        </p>

        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleMakeAdmin}
          disabled={loading}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          {loading ? "Processing..." : "Make Me Admin"}
        </button>

        <p className="mt-4 text-sm text-gray-500">
          This is a temporary feature for initial setup. Remove this page after granting admin access.
        </p>
      </div>
    </div>
  );
}
