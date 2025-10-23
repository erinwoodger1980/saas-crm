"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, setJwt } from "@/lib/api";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const loginEmail = email.trim();
      const loginPassword = password;
      const res = await apiFetch<{ token?: string; jwt?: string }>("/auth/login", {
        method: "POST",
        json: { email: loginEmail, password: loginPassword },
      });
      const authToken = res?.token || res?.jwt;
      if (authToken) {
        setJwt(authToken);
        router.push("/dashboard");
      } else {
        throw new Error("Invalid login response");
      }
    } catch (err: any) {
      console.error(err);
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="text-2xl font-semibold text-center mb-2">Welcome back 👋</h1>
        <p className="text-gray-500 text-center mb-6">
          Log in to your Joinery AI account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Work email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black py-3 text-white hover:bg-gray-800 transition"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 flex justify-between text-sm text-gray-600">
          <Link href="/forgot-password" className="hover:text-black">
            Forgot password?
          </Link>
          <Link href="/signup" className="hover:text-black">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}