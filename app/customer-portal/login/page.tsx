"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api";
import { setCustomerPortalToken } from "@/lib/customer-portal-auth";

export default function CustomerPortalLoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await apiFetch<{ token: string }>("/customer-auth/login", {
        method: "POST",
        json: {
          email,
          password,
        },
      });

      if (!data?.token) {
        throw new Error("Login failed");
      }

      setCustomerPortalToken(data.token);
      router.push("/customer-portal");
    } catch (err: any) {
      const status = err?.status;
      const apiError = err?.details?.error || err?.details?.message;

      // Make wrong-credentials cases explicit and friendly
      if (status === 401) {
        toast({
          title: "Incorrect email or password",
          description: "Please check your details and try again.",
          variant: "destructive",
        });
        return;
      }

      if (status === 403) {
        toast({
          title: "Account inactive",
          description: String(apiError || "Your account is inactive. Please contact support."),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Login failed",
        description: String(apiError || err?.message || "Please try again"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="mx-auto w-full max-w-lg px-6 py-10 space-y-6">
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-xl p-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Fire Door Schedule
          </h1>
          <p className="text-slate-600 mt-2">Customer portal • Sign in to view job status</p>
        </div>

        <Card className="bg-white/70 backdrop-blur border-slate-200">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
