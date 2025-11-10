'use client';

import { useState } from 'react';
import { Sparkles, Loader2, X, Check } from 'lucide-react';
import TiptapEditor from '../TiptapEditor';
import { apiFetch } from '@/lib/api';

interface HeroEditorProps {
  tenantId: string;
  headline: string;
  subhead: string;
  urgencyBanner: string;
  ctaText: string;
  onHeadlineChange: (_: string) => void;
  onSubheadChange: (_: string) => void;
  onUrgencyBannerChange: (_: string) => void;
  onCtaTextChange: (_: string) => void;
}

interface Suggestion {
  headline: string;
  subhead: string;
}

export default function HeroEditor({
  tenantId,
  headline,
  subhead,
  urgencyBanner,
  ctaText,
  onHeadlineChange,
  onSubheadChange,
  onUrgencyBannerChange,
  onCtaTextChange,
}: HeroEditorProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');

  const handleAISuggestion = async () => {
    setLoading(true);
    setError('');
    setSuggestions([]);
    
    try {
      const response = await apiFetch<{ suggestions: Suggestion[] }>(
        `/admin/landing-tenants/${tenantId}/ai-suggest`,
        {
          method: 'POST',
          json: {
            currentHeadline: headline,
            currentSubhead: subhead,
          }
        }
      );

      if (response?.suggestions && response.suggestions.length > 0) {
        setSuggestions(response.suggestions);
        setShowModal(true);
      } else {
        setError('No suggestions generated. Please try again.');
      }
    } catch (err: any) {
      console.error('AI suggestion error:', err);
      setError(err.message || 'Failed to generate suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = (suggestion: Suggestion) => {
    onHeadlineChange(suggestion.headline);
    onSubheadChange(suggestion.subhead);
    setShowModal(false);
    setSuggestions([]);
  };

  return (
    <>
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
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            AI Suggestions
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

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
        </div>
      </div>
    </div>

      {/* AI Suggestions Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="text-purple-600" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">AI Suggestions</h3>
                  <p className="text-sm text-gray-600">Select a headline and subhead pair</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Suggestions List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-5 hover:border-purple-300 hover:bg-purple-50/30 transition cursor-pointer group"
                  onClick={() => applySuggestion(suggestion)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                          {index + 1}
                        </span>
                        <h4 className="font-bold text-gray-900 text-lg">{suggestion.headline}</h4>
                      </div>
                      <p className="text-gray-700 leading-relaxed">{suggestion.subhead}</p>
                    </div>
                    <button
                      className="flex-shrink-0 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition opacity-0 group-hover:opacity-100 flex items-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        applySuggestion(suggestion);
                      }}
                    >
                      <Check size={16} />
                      Use This
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  💡 Click any suggestion to apply it to your landing page
                </p>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}           onChange={(e) => onCtaTextChange(e.target.value)}
            placeholder="Get Your Free Quote"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}
