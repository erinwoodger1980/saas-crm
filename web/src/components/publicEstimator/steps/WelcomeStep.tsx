/**
 * Welcome step for the public estimator.
 * Sets expectations and shows trust signals.
 */

import { Building2, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeStepProps {
  brandName: string;
  brandLogo?: string;
  heroImage?: string;
  reviewScore?: number;
  reviewCount?: number;
  reviewSource?: string;
  testimonials?: Array<{
    name: string;
    location?: string;
    quote: string;
  }>;
  primaryColor?: string;
  onNext: () => void;
}

export function WelcomeStep({
  brandName,
  brandLogo,
  heroImage,
  reviewScore,
  reviewCount,
  reviewSource,
  testimonials,
  primaryColor = '#3b82f6',
  onNext,
}: WelcomeStepProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* Hero section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-50 to-white p-8 shadow-sm">
        {heroImage && (
          <div 
            className="absolute inset-0 opacity-10 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
        )}
        
        <div className="relative space-y-4">
          <div className="flex items-center gap-4">
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={brandName}
                className="h-16 w-16 rounded-2xl border border-slate-200 bg-white object-contain p-2"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xl font-bold text-slate-400">
                {brandName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                FREE estimator powered by AI
              </h1>
              <p className="text-sm text-slate-600">{brandName}</p>
            </div>
          </div>

          {/* Trust signals (show when either metric is present) */}
          {(typeof reviewScore === 'number' || typeof reviewCount === 'number') && (
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={i < Math.round(Number(reviewScore || 0)) ? 'text-amber-400' : 'text-slate-300'}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="font-medium text-slate-700">
                {typeof reviewScore === 'number' ? reviewScore.toFixed(1) : '—'} / 5
              </span>
              <span className="text-slate-500">
                ({typeof reviewCount === 'number' ? reviewCount : 0} {reviewSource || 'reviews'})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Friendly intro */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
        <p className="text-base text-slate-700 leading-relaxed">
          Welcome! Answer a few quick questions and upload a photo of your door or window opening. 
          Our AI will measure the dimensions, then our expert team will review everything and send you 
          a detailed, accurate quote. <span className="font-semibold">No pressure, no obligation.</span>
        </p>
      </div>

      {/* What you'll get */}
      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          How it works:
        </h2>
        <div className="space-y-3">
          <Feature
            icon={<Clock className="h-5 w-5" />}
            title="Fast & simple"
            description="Just 3 minutes to complete – answer a few questions and upload a photo"
            primaryColor={primaryColor}
          />
          <Feature
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="Expert reviewed"
            description={`${brandName}'s team checks every detail before sending your quote`}
            primaryColor={primaryColor}
          />
          <Feature
            icon={<Building2 className="h-5 w-5" />}
            title="No obligation"
            description="Free, detailed estimate – no spam, no pressure to proceed"
            primaryColor={primaryColor}
          />
        </div>
      </div>

      {/* Testimonial */}
      {testimonials && testimonials.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
          <blockquote className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-700">
              {testimonials[0].quote}
            </p>
            <footer className="text-sm font-medium text-slate-900">
              — {testimonials[0].name}
              {testimonials[0].location && (
                <span className="font-normal text-slate-500">
                  , {testimonials[0].location}
                </span>
              )}
            </footer>
          </blockquote>
        </div>
      )}

      {/* CTA */}
      <Button
        onClick={onNext}
        size="lg"
        className="w-full gap-2 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow py-7"
        style={{ backgroundColor: primaryColor }}
      >
        Get my free estimate
        <ArrowRight className="h-5 w-5" />
      </Button>

      <div className="space-y-2">
        <p className="text-center text-sm text-slate-600">
          ✓ Takes 3 minutes · ✓ No payment info needed · ✓ Your details are safe
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span>Your privacy protected · We never share your details</span>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
  primaryColor,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  primaryColor: string;
}) {
  return (
    <div className="flex gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: primaryColor }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-900">{title}</div>
        <div className="text-sm text-slate-600">{description}</div>
      </div>
    </div>
  );
}
