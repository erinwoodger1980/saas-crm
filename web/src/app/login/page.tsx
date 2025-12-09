"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, setJwt } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function doLogin(loginEmail: string, loginPassword: string) {
    setError("");
    setLoading(true);
    try {
      // Support both email and username login
      const payload: any = { password: loginPassword };
      const identifier = loginEmail.trim();
      // If contains @, treat as email, otherwise as username
      if (identifier.includes('@')) {
        payload.email = identifier;
      } else {
        payload.username = identifier;
      }
      
      const res = await apiFetch<{ jwt: string }>("/auth/login", {
        method: "POST",
        json: payload,
      });
      const authToken = res?.jwt;
      if (authToken) {
        setJwt(authToken);
        router.push("/dashboard");
      } else {
        throw new Error("Invalid login response");
      }
    } catch (err: any) {
      console.error(err);
      setError("Invalid email/username or password");
    } finally {
      setLoading(false);
    }
  }

  // If dev credentials were prefilled via sessionStorage, auto-submit once
  useEffect(() => {
    const devEmail = sessionStorage.getItem("devLoginEmail");
    const devPassword = sessionStorage.getItem("devLoginPassword");
    if (devEmail && devPassword) {
      setEmail(devEmail);
      setPassword(devPassword);
      // Clear immediately to avoid loops
      sessionStorage.removeItem("devLoginEmail");
      sessionStorage.removeItem("devLoginPassword");
      // Kick off login after a short tick so state updates don't interfere
      setTimeout(() => {
        void doLogin(devEmail, devPassword);
      }, 0);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doLogin(email, password);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="text-2xl font-semibold text-center mb-2">Welcome back 👋</h1>
        <p className="text-gray-500 text-center mb-6">
          Log in to your Joinery AI account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email or Username
            </label>
            <input
              id="email"
              type="text"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="your@email.com or username"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
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