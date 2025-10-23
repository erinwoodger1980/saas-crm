"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type IssueResponse = { token: string };

type Status = "loading" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  signup_already_completed:
    "Your account is already active. You can sign in using the email and password you set earlier.",
  invalid_session_id: "We couldn’t find that checkout session. Please restart the sign-up flow.",
  session_incomplete: "Stripe hasn’t confirmed your checkout yet. Wait a few seconds and try again.",
  missing_email: "We couldn’t read the email from Stripe. Contact support if this persists.",
  rate_limited: "Too many attempts. Wait a minute before trying again.",
};

function friendlyMessage(code: string) {
  return ERROR_MESSAGES[code] || code;
}

function buildOnboardingUrl(token: string, sessionId: string) {
  const search = new URLSearchParams({ token });
  if (sessionId) search.set("session_id", sessionId);
  return `/onboarding/create-account?${search.toString()}`;
}

export default function SignupSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get("session_id") || "";
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  const issueToken = useCallback(async () => {
    if (!sessionId) {
      setStatus("error");
      setError("Missing Stripe session. Please return to checkout and try again.");
      return;
    }

    setStatus("loading");
    setError(null);
    try {
      const { token } = await apiFetch<IssueResponse>("/auth/issue-signup-token", {
        method: "POST",
        json: { session_id: sessionId },
      });
      if (!token) throw new Error("No signup token issued");
      router.replace(buildOnboardingUrl(token, sessionId));
    } catch (e: any) {
      setStatus("error");
      const raw = e?.details?.error || e?.message || "Failed to issue signup token";
      setError(friendlyMessage(raw));
    }
  }, [router, sessionId]);

  useEffect(() => {
    issueToken();
  }, [issueToken]);

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-xl p-6 text-center">
        <h1 className="text-2xl font-semibold mb-3">Almost there…</h1>
        <p className="text-gray-600">Securing your account details with Stripe.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-6 text-center space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">We hit a snag</h1>
        <p className="text-gray-600">
          {error || "We couldn’t verify your checkout session just yet."}
        </p>
        {error === ERROR_MESSAGES.signup_already_completed && (
          <p className="mt-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-800">
              Go to login
            </Link>
          </p>
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={issueToken}
          className="bg-black text-white rounded px-5 py-3"
          type="button"
        >
          Try again
        </button>
        <Link href="/signup" className="text-sm text-gray-500 hover:text-gray-700">
          Go back to sign-up
        </Link>
      </div>
    </main>
  );
}
