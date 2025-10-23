"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SetPasswordForm from "@/components/SetPasswordForm";
import { apiFetch } from "@/lib/api";

type IssueResponse = { token: string };

export default function CreateAccountPage() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get("session_id") || "";
  const initialToken = params.get("token") || "";

  const [token, setToken] = useState(initialToken);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialToken && initialToken !== token) {
      setToken(initialToken);
    }
  }, [initialToken, token]);

  const queryString = useMemo(() => {
    const search = new URLSearchParams();
    if (sessionId) search.set("session_id", sessionId);
    if (token) search.set("token", token);
    return search.toString();
  }, [sessionId, token]);

  useEffect(() => {
    if (!queryString) return;
    if (typeof window !== "undefined") {
      const current = window.location.search.replace(/^\?/, "");
      if (current === queryString) return;
    }
    router.replace(`/onboarding/create-account?${queryString}`, { scroll: false });
  }, [queryString, router]);

  const handleResend = useCallback(async () => {
    if (!sessionId) {
      setError("Missing session. Please restart the checkout flow.");
      return null;
    }
    try {
      const { token: freshToken } = await apiFetch<IssueResponse>("/auth/issue-signup-token", {
        method: "POST",
        json: { session_id: sessionId },
      });
      setToken(freshToken);
      setError(null);
      return freshToken;
    } catch (e: any) {
      const message = e?.details?.error || e?.message || "Failed to issue a new token";
      setError(message);
      return null;
    }
  }, [sessionId]);

  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Create your account</h1>
        <p className="text-gray-600">
          Choose a password to finish setting up your Joinery AI workspace.
        </p>
      </div>
      {error && (
        <div className="border border-red-300 bg-red-50 text-red-700 p-3 rounded">{error}</div>
      )}
      <SetPasswordForm
        token={token}
        sessionId={sessionId}
        onTokenRefreshed={setToken}
        onResend={handleResend}
        redirectPath="/dashboard"
      />
    </main>
  );
}
