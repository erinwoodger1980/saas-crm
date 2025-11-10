"use client";

import { useCallback, useEffect, useState } from "react";
import PreLaunchHero from "./PreLaunchHero";
import ValueProps from "./ValueProps";
import SocialProof from "./SocialProof";
import HowItWorks from "./HowItWorks";
import FAQ from "./FAQ";
import Footer from "./Footer";
import CookieBanner from "./CookieBanner";
import DemoModal from "./DemoModal";
import FeatureDetailBand from "./FeatureDetailBand";
import { getStoredReferral, storeReferral } from "@/lib/referral";

const DEMO_VIDEO_URL = "https://player.vimeo.com/video/123456789";

export default function LandingPage() {
  const [referral, setReferral] = useState<string | undefined>();
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const refFromParams = params.get("ref");
    if (refFromParams) {
      storeReferral(refFromParams);
      setReferral(refFromParams);
      return;
    }
    const stored = getStoredReferral();
    if (stored) setReferral(stored);
  }, []);

  useEffect(() => {
    console.log("JoineryAI landing page viewed (pre-launch)", { referral: referral ?? null });
  }, [referral]);

  const handleCta = useCallback(
    (source: string) => {
      console.log("JoineryAI CTA", { source, referral: referral ?? null });
    },
    [referral],
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <PreLaunchHero onOpenDemo={() => setIsDemoOpen(true)} onCtaClick={handleCta} />
      <main className="flex-1">
        <ValueProps />
        <FeatureDetailBand />
        <SocialProof />
        {/* Removed Pricing section for pre-launch */}
        <HowItWorks />
        <FAQ />
      </main>
      <Footer />
      <CookieBanner />
      <DemoModal
        open={isDemoOpen}
        onOpenChange={setIsDemoOpen}
        videoUrl={DEMO_VIDEO_URL}
      />
    </div>
  );
}
