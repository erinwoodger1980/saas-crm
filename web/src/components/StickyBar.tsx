"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface StickyBarProps {
  brandName: string;
  logoSrc?: string;
  phone?: string;
  calendlyUrl?: string;
  onGetQuoteClick: () => void;
  trackEvent?: (event: string, params?: any) => void;
}

export function StickyBar({
  brandName,
  logoSrc = "/images/wealden/logo.png",
  phone,
  calendlyUrl,
  onGetQuoteClick,
  trackEvent,
}: StickyBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 80);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCallClick = () => {
    trackEvent?.("click_contact_phone", { location: "sticky_bar" });
  };

  const handleCalendlyClick = () => {
    trackEvent?.("click_book_call", { location: "sticky_bar" });
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#18332F] text-white shadow-lg animate-slideDown">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          {logoSrc && (
            <div className="relative w-10 h-10 flex-shrink-0">
              <Image
                src={logoSrc}
                alt={`${brandName} logo`}
                fill
                className="object-contain"
                sizes="40px"
              />
            </div>
          )}
          <span className="font-semibold text-lg hidden sm:inline">{brandName}</span>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          {phone && (
            <a
              href={`tel:${phone}`}
              onClick={handleCallClick}
              className="px-4 py-2 bg-[#C9A14A] hover:bg-[#B89140] text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
              aria-label={`Call ${phone}`}
            >
              <span>☎</span>
              <span className="hidden sm:inline">Call</span>
            </a>
          )}
          {calendlyUrl && (
            <a
              href={calendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleCalendlyClick}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium text-sm transition-colors hidden md:inline-block"
              aria-label="Book a call with Wealden Joinery"
            >
              Book a Call
            </a>
          )}
          <button
            onClick={onGetQuoteClick}
            className="px-4 py-2 bg-[#C9A14A] hover:bg-[#B89140] text-white rounded-lg font-medium text-sm transition-colors"
            aria-label="Get your free quotation"
          >
            Get a Quote
          </button>
        </div>
      </div>
    </div>
  );
}
