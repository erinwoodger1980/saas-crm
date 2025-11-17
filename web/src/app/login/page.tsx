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

  // Auto-fill dev credentials if coming from impersonation
  useEffect(() => {
    const devEmail = sessionStorage.getItem('devLoginEmail');
    const devPassword = sessionStorage.getItem('devLoginPassword');
    if (devEmail && devPassword) {
      setEmail(devEmail);
      setPassword(devPassword);
      // Clear them so they don't persist
      sessionStorage.removeItem('devLoginEmail');
      sessionStorage.removeItem('devLoginPassword');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const loginEmail = email.trim();
      const loginPassword = password;
      const res = await apiFetch<{ jwt: string }>("/auth/login", {
        method: "POST",
        json: { email: loginEmail, password: loginPassword },
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
            // Auto sign-in after prefill
            setTimeout(() => {
              void doLogin(devEmail, devPassword);
            }, 50);
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
        async function doLogin(loginEmail: string, loginPassword: string) {
          setError("");
          setLoading(true);
          try {
            const res = await apiFetch<{ jwt: string }>("/auth/login", {
              method: "POST",
              json: { email: loginEmail.trim(), password: loginPassword },
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
            setError("Invalid email or password");
          } finally {
            setLoading(false);
          }
        }
            {loading ? "Signing in…" : "Sign in"}
        async function handleSubmit(e: React.FormEvent) {
          e.preventDefault();
          await doLogin(email, password);
        }
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