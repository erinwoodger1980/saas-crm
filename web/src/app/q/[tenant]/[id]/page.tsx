"use client";

/**
 * Public Estimator Page - Premium mobile-first estimating + lead gen funnel
 * 
 * Supports both AD (direct traffic) and INVITE (personalized lead link) modes.
 * 6-step flow with live pricing, auto-save, favourites, share, and interaction tracking.
 */
import { useParams } from "next/navigation";
import { PublicEstimatorStepper } from "@/components/publicEstimator/PublicEstimatorStepper";

export default function PublicQuestionnairePage() {
  const params = useParams();
  const tenantSlug = params.tenant as string;

  const handleComplete = () => {
    console.log("[PublicQuestionnairePage] Estimator completed");
    // Could redirect to thank you page or show success message
  };

  return (
    <PublicEstimatorStepper 
      tenantSlug={tenantSlug}
      onComplete={handleComplete}
    />
  );
}
