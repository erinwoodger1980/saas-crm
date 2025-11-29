'use client';

import React from 'react';

interface SocialProofPanelProps {
  branding: {
    name: string;
    logoUrl?: string;
    primaryColor?: string;
    galleryImageUrls?: string[];
    testimonials?: Array<{ author: string; text: string; rating?: number }>;
    reviewScore?: number;
    reviewCount?: number;
    reviewSourceLabel?: string;
    serviceArea?: string;
    guarantees?: Array<{ title: string; description: string }>;
    certifications?: Array<{ name: string; description: string }>;
  } | null;
  primaryColor?: string;
}

export function SocialProofPanel({ branding, primaryColor = '#3b82f6' }: SocialProofPanelProps) {
  if (!branding) return null;
  const { testimonials = [], galleryImageUrls = [], reviewScore, reviewCount, reviewSourceLabel, serviceArea, guarantees = [], certifications = [] } = branding;
  const hasTestimonials = testimonials.length > 0;
  const hasGallery = galleryImageUrls.length > 0;
  const hasGuarantees = guarantees.length > 0;
  const hasCerts = certifications.length > 0;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
      <div className="space-y-5">
        {/* Review summary */}
        {(reviewScore || reviewCount) && (
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Rated</p>
              <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                {reviewScore?.toFixed(1) ?? '—'} / 5
              </p>
              {reviewSourceLabel && (
                <p className="text-xs text-slate-500">{reviewSourceLabel}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">Reviews</p>
              <p className="text-xl font-semibold" style={{ color: primaryColor }}>{reviewCount ?? 0}</p>
              {serviceArea && (
                <p className="text-xs text-slate-500">{serviceArea}</p>
              )}
            </div>
          </div>
        )}

        {/* Gallery */}
        {hasGallery && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Recent projects</h4>
            <div className="grid grid-cols-3 gap-2">
              {galleryImageUrls.slice(0, 6).map((url, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl">
                  <img src={url} alt={`Gallery ${i + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Testimonials */}
        {hasTestimonials && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">What clients say</h4>
            <div className="space-y-3">
              {testimonials.slice(0, 3).map((t, i) => (
                <blockquote key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="text-slate-700">“{t.text}”</p>
                  <footer className="mt-1 text-xs font-medium text-slate-600">— {t.author}{typeof t.rating === 'number' ? ` • ${t.rating.toFixed(1)}/5` : ''}</footer>
                </blockquote>
              ))}
            </div>
          </div>
        )}

        {/* Guarantees */}
        {hasGuarantees && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Our Guarantees</h4>
            <ul className="space-y-2">
              {guarantees.slice(0, 3).map((g, i) => (
                <li key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-800">{g.title}</p>
                  {g.description && <p className="text-slate-600 text-xs mt-1">{g.description}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Certifications */}
        {hasCerts && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Certifications</h4>
            <ul className="space-y-2">
              {certifications.slice(0, 3).map((c, i) => (
                <li key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-800">{c.name}</p>
                  {c.description && <p className="text-slate-600 text-xs mt-1">{c.description}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!hasGallery && !hasTestimonials && !hasGuarantees && !hasCerts && !(reviewScore || reviewCount) && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-700 mb-2">💡 Configure social proof</p>
            <p className="text-xs text-slate-500">
              Add testimonials, guarantees, certifications, gallery images, and review scores in Settings → Company Info tab.
              This helps build trust with potential customers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
