"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setJwt } from "@/lib/api";

type Props = {
  token: string | null;
  sessionId?: string | null;
  onTokenRefreshed?: (_token: string) => void;
  onResend?: () => Promise<string | null>;
  redirectPath?: string;
};

type SetPasswordResponse = { jwt: string };

type ErrorState = {
  message: string;
  allowResend: boolean;
};

const ERROR_MESSAGES: Record<string, string> = {
  token_expired: "Your link expired. Request a new one below.",
  token_consumed: "That link was already used. Request a new one below.",
  token_invalid: "Invalid signup link. Request a fresh one.",
  session_incomplete: "Stripe hasn’t confirmed your checkout yet. Try again in a moment.",
  password_too_short: "Password must be at least 8 characters.",
};

function friendlyMessage(code: string) {
  return ERROR_MESSAGES[code] || code;
}

export default function SetPasswordForm({
  token,
  sessionId,
  onTokenRefreshed,
  onResend,
  redirectPath = "/dashboard",
}: Props) {
  const router = useRouter();
  const [currentToken, setCurrentToken] = useState(token?.trim() || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    setCurrentToken(token?.trim() || "");
    setError(null);
  }, [token]);

  const isTokenPresent = useMemo(() => Boolean(currentToken), [currentToken]);

  const handleSubmit = useCallback(
    async (evt: FormEvent) => {
      evt.preventDefault();
      if (!currentToken) {
        setError({ message: "Missing signup token. Please resend the email.", allowResend: true });
        return;
      }
      if (!password || password.length < 8) {
        setError({ message: "Password must be at least 8 characters.", allowResend: false });
        return;
      }
      if (password !== confirm) {
        setError({ message: "Passwords do not match.", allowResend: false });
        return;
      }

      setSubmitting(true);
      setError(null);
      try {
        const { jwt } = await apiFetch<SetPasswordResponse>("/auth/set-password", {
          method: "POST",
          json: { token: currentToken, password },
        });
        if (!jwt) throw new Error("Missing JWT response");
        setJwt(jwt);
        setSuccess(true);
        setTimeout(() => router.push(redirectPath), 800);
      } catch (e: any) {
        const code = e?.details?.error || e?.message || "Failed to set password";
        const allowResend =
          code === "token_expired" || code === "token_consumed" || code === "token_invalid";
        setError({ message: friendlyMessage(code), allowResend });
        setSubmitting(false);
      }
    },
    [confirm, currentToken, password, redirectPath, router],
  );

  const handleResend = useCallback(async () => {
    if (!onResend) return;
    setResending(true);
    setError(null);
    try {
      const newToken = await onResend();
      if (newToken) {
        setCurrentToken(newToken);
        onTokenRefreshed?.(newToken);
      }
    } catch (e: any) {
      const code = e?.details?.error || e?.message || "Unable to resend token";
      setError({ message: friendlyMessage(code), allowResend: true });
    } finally {
      setResending(false);
    }
  }, [onResend, onTokenRefreshed]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-600 mb-1" htmlFor="password">
          Create password
        </label>
        <input
          id="password"
          type="password"
          className="w-full border rounded p-2"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1" htmlFor="confirm">
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          className="w-full border rounded p-2"
          placeholder="Re-enter password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {!isTokenPresent && (
        <div className="border border-yellow-300 bg-yellow-50 text-yellow-800 p-3 rounded">
          We couldn’t find a signup token. {sessionId ? "Request a new one below." : "Return to the signup link."}
        </div>
      )}
      {error && (
        <div className="border border-red-300 bg-red-50 text-red-700 p-3 rounded">
          {error.message}
        </div>
      )}
      {success && (
        <div className="border border-green-300 bg-green-50 text-green-700 p-3 rounded">
          Password saved. Redirecting…
        </div>
      )}
      <button
        type="submit"
        disabled={!isTokenPresent || submitting}
        className="w-full bg-black text-white rounded px-5 py-3 disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Save password"}
      </button>
      {onResend && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            {resending ? "Requesting…" : "Resend link"}
          </button>
        </div>
      )}
    </form>
  );
}
