'use client';

import { useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';

interface PreviewPanelProps {
  tenantSlug: string;
  headline: string;
  subhead: string;
  urgencyBanner: string;
  ctaText: string;
  images: any[];
  reviews: any[];
  guarantees: any[];
}

export default function PreviewPanel({
  tenantSlug,
  headline,
  subhead,
  urgencyBanner,
  ctaText,
  images,
  reviews,
  guarantees,
}: PreviewPanelProps) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Build preview URL with query params to show draft content
  const previewUrl = `/${tenantSlug}/kent?preview=true&t=${Date.now()}`;

  return (
    <div className="w-1/2 border-l border-gray-200 bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Live Preview</h3>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setDevice('desktop')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 transition ${
                device === 'desktop'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Monitor size={16} />
              Desktop
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 transition ${
                device === 'mobile'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Smartphone size={16} />
              Mobile
            </button>
          </div>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="flex-1 p-6 overflow-auto">
        <div
          className={`bg-white rounded-lg shadow-lg overflow-hidden mx-auto transition-all duration-300 ${
            device === 'mobile' ? 'max-w-[375px]' : 'w-full'
          }`}
          style={{
            height: device === 'mobile' ? '667px' : '100%',
          }}
        >
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            title="Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border-t border-blue-200 px-6 py-3">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">Preview Mode:</span> Changes appear instantly but are not live until you publish.
        </p>
      </div>
    </div>
  );
}
