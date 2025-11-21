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
                Get your instant estimate
              </h1>
              <p className="text-sm text-slate-600">{brandName}</p>
            </div>
          </div>

          {/* Trust signals */}
          {reviewScore && reviewCount && (
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={i < Math.round(reviewScore) ? 'text-amber-400' : 'text-slate-300'}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="font-medium text-slate-700">
                {reviewScore} / 5
              </span>
              <span className="text-slate-500">
                ({reviewCount} {reviewSource || 'reviews'})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* What you'll get */}
      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          What you'll get:
        </h2>
        <div className="space-y-3">
          <Feature
            icon={<Clock className="h-5 w-5" />}
            title="Instant rough estimate"
            description="See pricing right away – takes just 3 minutes"
            primaryColor={primaryColor}
          />
          <Feature
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="No obligation"
            description="Free estimate with no pressure to commit"
            primaryColor={primaryColor}
          />
          <Feature
            icon={<Building2 className="h-5 w-5" />}
            title="Expert follow-up"
            description="We'll arrange a survey to confirm final details"
            primaryColor={primaryColor}
          />
        </div>
      </div>

      {/* Testimonial */}
      {testimonials && testimonials.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
          <blockquote className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-700">
              "{testimonials[0].quote}"
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
        className="w-full gap-2 text-base"
        style={{ backgroundColor: primaryColor }}
      >
        Start my estimate
        <ArrowRight className="h-5 w-5" />
      </Button>

      <p className="text-center text-xs text-slate-500">
        Takes about 3 minutes · No payment required
      </p>
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
