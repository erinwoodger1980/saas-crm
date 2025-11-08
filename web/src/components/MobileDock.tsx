"use client";

interface MobileDockProps {
  phone?: string;
  whatsapp?: string;
  onGetQuoteClick: () => void;
  trackEvent?: (_event: string, _params?: any) => void;
}

export function MobileDock({
  phone,
  whatsapp,
  onGetQuoteClick,
  trackEvent,
}: MobileDockProps) {
  const handleCallClick = () => {
    trackEvent?.("click_contact_phone", { location: "mobile_dock" });
  };

  const handleWhatsAppClick = () => {
    trackEvent?.("click_whatsapp", { location: "mobile_dock" });
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#18332F] text-white shadow-lg md:hidden">
      <div className="grid grid-cols-3 gap-0">
        {phone && (
          <a
            href={`tel:${phone}`}
            onClick={handleCallClick}
            className="flex flex-col items-center justify-center py-3 px-2 border-r border-white/10 hover:bg-white/10 transition-colors"
            aria-label={`Call ${phone}`}
          >
            <span className="text-2xl mb-1">📞</span>
            <span className="text-xs font-medium">Call</span>
          </a>
        )}
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWhatsAppClick}
            className="flex flex-col items-center justify-center py-3 px-2 border-r border-white/10 hover:bg-white/10 transition-colors"
            aria-label="Message us on WhatsApp"
          >
            <span className="text-2xl mb-1">💬</span>
            <span className="text-xs font-medium">WhatsApp</span>
          </a>
        )}
        <button
          onClick={onGetQuoteClick}
          className="flex flex-col items-center justify-center py-3 px-2 bg-[#C9A14A] hover:bg-[#B89140] transition-colors"
          aria-label="Get your free quotation"
        >
          <span className="text-2xl mb-1">📝</span>
          <span className="text-xs font-medium">Get Quote</span>
        </button>
      </div>
    </div>
  );
}
