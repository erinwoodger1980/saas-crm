"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Eye, EyeOff } from "lucide-react";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function getSafeNextPath(): string {
    if (typeof window === "undefined") return "/dashboard";
    try {
      const sp = new URLSearchParams(window.location.search);
      const raw = (sp.get("next") || "").trim();
      if (!raw) return "/dashboard";

      // Allow only same-site absolute paths (no protocol/host)
      if (!raw.startsWith("/")) return "/dashboard";
      if (raw.startsWith("//")) return "/dashboard";
      return raw;
    } catch {
      return "/dashboard";
    }
  }

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
      
      await apiFetch("/auth/login", {
        method: "POST",
        json: payload,
      });
      // Use window.location instead of router.push to force a full page refresh
      // so middleware sees the freshly-set HttpOnly auth cookie.
      const nextPath = getSafeNextPath();
      window.location.assign(new URL(nextPath, window.location.origin).toString());
    } catch (err: any) {
      console.error(err);
      const status = err?.status;
      const apiError = err?.details?.error || err?.details?.message;

      // Make wrong-credentials cases explicit and friendly
      if (status === 401) {
        const code = String(apiError || "").toLowerCase();
        if (code === "user_not_found") {
          toast({
            title: "Email/username not found",
            description: "Check it and try again.",
            variant: "destructive",
          });
          setError("Email/username not found");
          return;
        }
        if (code === "invalid_password") {
          toast({
            title: "Incorrect password",
            description: "Check it and try again.",
            variant: "destructive",
          });
          setError("Incorrect password");
          return;
        }
        toast({
          title: "Incorrect email or password",
          description: "Please check your details and try again.",
          variant: "destructive",
        });
        setError("Incorrect email or password");
        return;
      }

      if (status === 403) {
        toast({
          title: "Account inactive",
          description: String(apiError || "Your account is inactive. Please contact support."),
          variant: "destructive",
        });
        setError("Account inactive");
        return;
      }

      const message = String(apiError || err?.message || "Please try again");
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
      setError(message);
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
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-black"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900"
                onClick={() => setShowPassword((s) => !s)}
                tabIndex={0}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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