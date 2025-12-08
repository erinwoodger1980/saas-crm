"use client";

import { useCallback, useEffect, useState } from "react";
import NewHero from "./NewHero";
import WhatItDoes from "./WhatItDoes";
import WhoItsFor from "./WhoItsFor";
import WhyItMatters from "./WhyItMatters";
import TheWorkflow from "./TheWorkflow";
import Comparison from "./Comparison";
import Trust from "./Trust";
import FinalCTA from "./FinalCTA";
import FAQ from "./FAQ";
import Footer from "./Footer";
import CookieBanner from "./CookieBanner";
import DemoModal from "./DemoModal";
import { getStoredReferral, storeReferral } from "@/lib/referral";

const DEMO_VIDEO_URL = "https://player.vimeo.com/video/123456789";

export default function NewHomepage() {
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
    console.log("JoineryAI homepage viewed", { referral: referral ?? null });
  }, [referral]);

  const handleCta = useCallback(
    (source: string) => {
      console.log("JoineryAI CTA", { source, referral: referral ?? null });
    },
    [referral],
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <NewHero onOpenDemo={() => setIsDemoOpen(true)} onCtaClick={handleCta} />
      <main className="flex-1">
        <WhatItDoes />
        <WhoItsFor />
        <WhyItMatters />
        <TheWorkflow />
        <Comparison />
        <Trust />
        <FinalCTA onCtaClick={handleCta} />
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
