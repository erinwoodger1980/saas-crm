import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

type FinalCTAProps = {
  onCtaClick?: (_source: string) => void;
};

export default function FinalCTA({ onCtaClick }: FinalCTAProps) {
  return (
    <section className="relative overflow-hidden px-6 py-20 sm:px-10 lg:px-20 bg-gradient-to-br from-emerald-600 via-emerald-500 to-cyan-600">
      {/* Background gradient blur */}
      <div className="absolute inset-0 opacity-20" aria-hidden>
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-white blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl text-center">
        {/* Main CTA */}
        <h2 className="text-4xl font-bold text-white sm:text-5xl mb-4">
          Ready to win more jobs?
        </h2>

        <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
          Get 14 days of full access to JoineryAI. No credit card. No setup fees. Start quoting and automating today.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Button
            asChild
            size="lg"
            className="gap-2 bg-white text-emerald-600 hover:bg-white/90"
            onClick={() => onCtaClick?.("footer-trial")}
          >
            <Link href="/early-access">
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white text-white hover:bg-white/10 gap-2"
            onClick={() => onCtaClick?.("footer-demo")}
          >
            <Link href="/demo">
              Schedule a Demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Social proof subtext */}
        <p className="text-sm text-white/80">
          💡 Most users see results within 48 hours of setup.
        </p>
      </div>
    </section>
  );
}
