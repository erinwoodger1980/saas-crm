"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";

type AreaMeta = {
  feature: string;
  label: string;
};

const AREA_MAP: Record<string, AreaMeta> = {
  "/": { feature: "marketing-home", label: "Marketing site" },
  "/dashboard": { feature: "dashboard", label: "Dashboard" },
  "/leads": { feature: "leads", label: "Leads" },
  "/opportunities": { feature: "opportunities", label: "Opportunities" },
  "/workshop": { feature: "workshop", label: "Workshop" },
  "/tasks": { feature: "tasks", label: "Tasks" },
  "/settings": { feature: "settings", label: "Settings" },
  "/billing": { feature: "billing", label: "Billing" },
  "/feedback": { feature: "feedback-admin", label: "Feedback admin" },
  "/q": { feature: "questionnaire", label: "Questionnaire" },
  "/login": { feature: "auth", label: "Authentication" },
  "/signup": { feature: "signup", label: "Sign up" },
};

function normalisePath(pathname: string | null): string {
  const base = (pathname || "/").split("?")[0].split("#")[0];
  const trimmed = base.replace(/\/+$/, "");
  return trimmed || "/";
}

function deriveArea(pathname: string | null): AreaMeta {
  const normalised = normalisePath(pathname);
  if (normalised !== "/") {
    const matchKey = Object.keys(AREA_MAP)
      .filter((key) => key !== "/")
      .find((key) => normalised === key || normalised.startsWith(`${key}/`));
    if (matchKey) {
      return AREA_MAP[matchKey];
    }
  }
  const direct = AREA_MAP[normalised];
  if (direct) return direct;

  const slug = normalised === "/" ? "home" : normalised.slice(1);
  const cleaned = slug
    .toLowerCase()
    .replace(/[^a-z0-9\-\/]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\-|\-$/g, "") || "unknown";
  const label = cleaned
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Unknown area";
  return { feature: cleaned, label };
}

export default function FeedbackWidget() {
  const { user } = useCurrentUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const area = useMemo(() => deriveArea(pathname ?? "/"), [pathname]);

  if (!user?.isEarlyAdopter) {
    return null;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!comment.trim()) {
      setError("Please include a quick note so the team knows what happened.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, any> = {
        feature: area.feature,
        comment: comment.trim(),
      };
      if (typeof window !== "undefined") {
        payload.sourceUrl = window.location.href;
      }
      await apiFetch("/feedback", {
        method: "POST",
        json: payload,
      });
      setSuccess(true);
      setComment("");
      setTimeout(() => setSuccess(false), 4000);
      setOpen(false);
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const details = err?.details;
      if (status === 401) {
        setError("Please sign in to send feedback.");
      } else if (details?.error === "feature_required") {
        setError("Missing feature tag. Please try again from the page you were on.");
      } else if (details?.error === "feedback_unavailable") {
        setError("Feedback is temporarily unavailable while we update the database. Please try again shortly.");
      } else {
        const message = err?.message || "Something went wrong";
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-24 right-6 z-[998] flex flex-col items-end gap-2">
        <Button
          size="lg"
          className="rounded-full bg-blue-600 px-5 shadow-lg shadow-blue-600/40 hover:bg-blue-700"
          onClick={() => {
            setOpen(true);
            setSuccess(false);
          }}
        >
          Give feedback
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setTimeout(() => {
              setError(null);
            }, 150);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Share your feedback</DialogTitle>
              <DialogDescription>
                Spotted something that feels off? Let the product team know.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="feedback-area">Area</Label>
                <Input id="feedback-area" value={area.label} readOnly />
              </div>

              <div className="space-y-1">
                <Label htmlFor="feedback-comment">What&apos;s happening?</Label>
                <Textarea
                  id="feedback-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Tell us what changed or what isn&apos;t working..."
                  rows={5}
                  className="resize-none"
                />
                <p className="text-xs text-slate-500">
                  Your message is sent straight to the Joinery AI developers.
                </p>
              </div>

              {error && <p className="text-sm text-rose-600">{error}</p>}
              {success && <p className="text-sm text-emerald-600">Thanks for the feedback!</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending..." : "Send feedback"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
