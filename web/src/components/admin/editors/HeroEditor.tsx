'use client';

import { Sparkles } from 'lucide-react';
import TiptapEditor from '../TiptapEditor';

interface HeroEditorProps {
  headline: string;
  subhead: string;
  urgencyBanner: string;
  ctaText: string;
  onHeadlineChange: (value: string) => void;
  onSubheadChange: (value: string) => void;
  onUrgencyBannerChange: (value: string) => void;
  onCtaTextChange: (value: string) => void;
}

export default function HeroEditor({
  headline,
  subhead,
  urgencyBanner,
  ctaText,
  onHeadlineChange,
  onSubheadChange,
  onUrgencyBannerChange,
  onCtaTextChange,
}: HeroEditorProps) {
  const handleAISuggestion = async () => {
    // TODO: Call AI endpoint for headline suggestions
    alert('AI suggestions coming soon!');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Hero Section</h2>
          <p className="text-sm text-gray-600 mt-1">
            Main headline, subhead, and call-to-action
          </p>
        </div>
        <button
          onClick={handleAISuggestion}
          className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
        >
          <Sparkles size={18} />
          AI Suggestions
        </button>
      </div>

      <div className="space-y-6">
        {/* Headline */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Headline
          </label>
          <TiptapEditor
            content={headline}
            onChange={onHeadlineChange}
            placeholder="Expert Joiners in Kent | Custom Kitchens & Renovations"
            className="mb-2"
          />
          <p className="text-xs text-gray-500">
            Keep it under 60 characters for best SEO impact
          </p>
        </div>

        {/* Subhead */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Subhead
          </label>
          <TiptapEditor
            content={subhead}
            onChange={onSubheadChange}
            placeholder="Transform your home with bespoke joinery. Family-run, fully insured, 20+ years experience."
          />
        </div>

        {/* Urgency Banner */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Urgency Banner (optional)
          </label>
          <input
            type="text"
            value={urgencyBanner}
            onChange={(e) => onUrgencyBannerChange(e.target.value)}
            placeholder="🔥 Limited Slots Available - Book Your Free Quote This Week"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Short message to create urgency (e.g., limited availability, seasonal offer)
          </p>
        </div>

        {/* CTA Button Text */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            CTA Button Text
          </label>
          <input
            type="text"
            value={ctaText}
            onChange={(e) => onCtaTextChange(e.target.value)}
            placeholder="Get Your Free Quote"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}
