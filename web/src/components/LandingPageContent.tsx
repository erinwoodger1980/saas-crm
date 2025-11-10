'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { StickyBar } from '@/components/StickyBar';
import { MobileDock } from '@/components/MobileDock';
import styles from './LandingPageContent.module.css';

interface LandingPageContentProps {
  tenant: any;
  content: any;
  location?: string;
  keyword?: string;
  searchParams?: { [key: string]: string | string[] | undefined };
}

function safeJson<T = any>(v: unknown): T | null {
  try {
    if (v == null) return null;
    if (typeof v === 'string') return JSON.parse(v) as T;
    if (typeof v === 'object') return v as T;
    return null;
  } catch {
    return null;
  }
}

export default function LandingPageContent({
  tenant,
  content,
  location,
  keyword,
  searchParams: _searchParams
}: LandingPageContentProps) {
  const [variant, setVariant] = useState<'A' | 'B'>('A');
  const [showExitIntent, setShowExitIntent] = useState(false);

  // Normalize optional JSON blobs once (guarantees, leadMagnet)
  const guarantees = useMemo(() => safeJson<{ bullets?: any[]; riskReversal?: string }>(content?.guarantees) || { bullets: [], riskReversal: '' }, [content?.guarantees]);
  const leadMagnet = useMemo(() => safeJson<{ title?: string; cta?: string; url?: string }>(content?.leadMagnet), [content?.leadMagnet]);

  // A/B test variant (localStorage persistence)
  useEffect(() => {
    const stored = localStorage.getItem('landing-variant');
    if (stored === 'A' || stored === 'B') {
      setVariant(stored);
    } else {
      const newVariant = Math.random() < 0.5 ? 'A' : 'B';
      setVariant(newVariant);
      localStorage.setItem('landing-variant', newVariant);
    }
  }, []);

  // Tracking helper
  const track = (eventName: string, params?: Record<string, any>) => {
    // GA4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, params);
    }
    // Meta Pixel
    if (typeof window !== 'undefined' && (window as any).fbq) {
      const pixelEventMap: Record<string, string> = {
        click_contact_phone: 'Contact',
        click_whatsapp: 'Contact',
        begin_checkout: 'ViewContent',
        generate_lead: 'Lead',
      };
      const pixelEvent = pixelEventMap[eventName];
      if (pixelEvent) {
        (window as any).fbq('track', pixelEvent, params);
      }
    }
  };

  // Track experiment impression
  useEffect(() => {
    if (tenant) {
      track('experiment_impression', {
        experiment_id: 'hero_headline_test',
        variant_id: variant,
        tenant_slug: tenant.slug,
        keyword: keyword || location || 'organic',
      });
    }
  }, [variant, tenant, keyword, location]);

  // Exit-intent detection
  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !showExitIntent) {
        setShowExitIntent(true);
        track('view_item_list', { item_list_id: 'exit_intent_modal', tenant_slug: tenant.slug });
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [showExitIntent, tenant.slug]);

  // Generate dynamic headlines
  const heroHeadline = keyword
    ? `${keyword} Specialists in ${location || tenant.serviceAreas?.[0] || 'Your Area'} | ${tenant.name}`
    : variant === 'A'
    ? content?.headline || `${tenant.name} - Expert Craftsmanship Since 1960`
    : `Transform Your Home with ${tenant.name}`;

  const heroSubheadline = keyword
    ? `Expert ${keyword.toLowerCase()} for homes and businesses in ${tenant.serviceAreas?.slice(0, 3).join(', ') || location || 'your area'}`
    : content?.subhead || `Bespoke timber windows and doors for ${tenant.serviceAreas?.slice(0, 3).join(', ') || 'your area'}`;

  return (
    <>
      <StickyBar
        brandName={tenant.name}
        logoSrc={tenant.logoUrl || '/placeholder-logo.png'}
        phone={tenant.phone}
        onGetQuoteClick={() => {
          document.getElementById('quote-form')?.scrollIntoView({ behavior: 'smooth' });
          track('select_content', { content_type: 'cta_button', item_id: 'sticky_bar_quote' });
        }}
        trackEvent={track}
      />

      <MobileDock
        phone={tenant.phone}
        onGetQuoteClick={() => {
          document.getElementById('quote-form')?.scrollIntoView({ behavior: 'smooth' });
          track('select_content', { content_type: 'cta_button', item_id: 'mobile_dock_quote' });
        }}
        trackEvent={track}
      />

      <main className={styles.container}>
        {/* Hero Section */}
        <section className={styles.hero} style={{ backgroundColor: tenant.brandColor || '#18332F' }}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroHeadline}>{heroHeadline}</h1>
            <p className={styles.heroSubheadline}>{heroSubheadline}</p>
            <div className={styles.heroButtons}>
              <a
                href={`tel:${tenant.phone}`}
                className={styles.buttonPrimary}
                onClick={() => track('click_contact_phone', { tenant_slug: tenant.slug, location: 'hero' })}
              >
                📞 Call Now: {tenant.phone}
              </a>
              <a
                href="#quote-form"
                className={styles.buttonSecondary}
                onClick={() => track('select_content', { content_type: 'cta_button', item_id: 'hero_quote' })}
              >
                Get Free Quote
              </a>
            </div>
          </div>
        </section>

        {/* Urgency Banner */}
        {content?.urgency && (
          <div className={styles.urgencyBanner}>
            <p className={styles.urgencyText}>
              ⚡ {content.urgency.text}
              {content.urgency.sub && <span className={styles.urgencySub}> {content.urgency.sub}</span>}
            </p>
          </div>
        )}

        {/* Trust Strip */}
        <section className={styles.trustStrip}>
          <div className={styles.trustLogos}>
            <Image src="/trust-fensa.png" alt="FENSA Approved" width={120} height={60} />
            <Image src="/trust-trustpilot.png" alt="Trustpilot Excellent" width={120} height={60} />
            <Image src="/trust-pas24.png" alt="PAS24 Certified" width={120} height={60} />
            <Image src="/trust-accoya.png" alt="Accoya Wood" width={120} height={60} />
          </div>
        </section>

        {/* Reviews Carousel */}
        {Array.isArray(tenant.reviews) && tenant.reviews.length > 0 && (
          <section className={styles.reviewsSection}>
            <h2 className={styles.sectionTitle}>What Our Customers Say</h2>
            <div className={styles.reviewsCarousel}>
              {tenant.reviews.map((review: any, idx: number) => (
                <div key={idx} className={styles.reviewCard}>
                  <div className={styles.reviewStars}>
                    {'⭐'.repeat(review.stars || 5)}
                  </div>
                  <p className={styles.reviewText}>&quot;{review.quote || review.text || ''}&quot;</p>
                  <p className={styles.reviewAuthor}>
                    <strong>{review.author}</strong>
                    {review.location && <span>, {review.location}</span>}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Guarantees */}
        {guarantees && (guarantees.bullets?.length || guarantees.riskReversal) && (
          <section className={styles.guaranteesSection}>
            <h2 className={styles.sectionTitle}>Our Guarantees</h2>
            {Array.isArray(guarantees.bullets) && guarantees.bullets.length > 0 && (
              <ul className={styles.guaranteesList}>
                {guarantees.bullets.map((bullet: any, idx: number) => (
                  <li key={idx} className={styles.guaranteeItem}>
                    ✅ {typeof bullet === 'string' ? bullet : bullet?.text || ''}
                  </li>
                ))}
              </ul>
            )}
            {guarantees.riskReversal && (
              <p className={styles.riskReversal}>
                🛡️ <strong>Risk-Free:</strong> {guarantees.riskReversal}
              </p>
            )}
          </section>
        )}

        {/* Price Anchor */}
        {content?.priceFromText && (
          <section className={styles.priceSection}>
            <h2 className={styles.sectionTitle}>Transparent Pricing</h2>
            <p className={styles.priceFrom}>{content.priceFromText}</p>
            {content.priceRange && (
              <p className={styles.priceRange}>{content.priceRange}</p>
            )}
          </section>
        )}

        {/* Gallery */}
        {Array.isArray(tenant.images) && tenant.images.length >= 2 && (
          <section className={styles.gallerySection}>
            <h2 className={styles.sectionTitle}>Our Work</h2>
            <div className={styles.galleryGrid}>
              {tenant.images.slice(0, 6).map((img: any, idx: number) => (
                <div key={idx} className={styles.galleryItem}>
                  <Image
                    src={img.src}
                    alt={img.alt || 'Project'}
                    width={600}
                    height={400}
                    className={styles.galleryImage}
                  />
                  {img.caption && <p className={styles.galleryCaption}>{img.caption}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Lead Magnet */}
        {leadMagnet && (
          <section className={styles.leadMagnetSection}>
            <div className={styles.leadMagnetCard}>
              <h3 className={styles.leadMagnetTitle}>
                📥 {leadMagnet.title || 'Free Download'}
              </h3>
              <a
                href={leadMagnet.url || '/brochure.pdf'}
                className={styles.buttonPrimary}
                onClick={() => track('generate_lead', {
                  method: 'download_brochure',
                  tenant_slug: tenant.slug,
                  lead_type: 'content_download',
                })}
                download
              >
                {leadMagnet.cta || 'Download Now'}
              </a>
            </div>
          </section>
        )}

        {/* Enhanced Quote Form */}
        <section id="quote-form" className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Get Your Free Quote</h2>
          <form
            className={styles.quoteForm}
            onSubmit={(e) => {
              e.preventDefault();
              track('generate_lead', {
                method: 'quote_form',
                tenant_slug: tenant.slug,
                lead_type: 'quote_request',
                form_fields: 5,
              });
              alert('Form submitted! (Demo)');
            }}
          >
            <div className={styles.formRow}>
              <input type="text" placeholder="Full Name *" required className={styles.formInput} />
              <input type="email" placeholder="Email *" required className={styles.formInput} />
            </div>
            <div className={styles.formRow}>
              <input type="tel" placeholder="Phone *" required className={styles.formInput} />
              <input type="text" placeholder="Postcode *" required className={styles.formInput} />
            </div>
            <select className={styles.formSelect} required>
              <option value="">Project Type *</option>
              <option>Sash Windows</option>
              <option>Casement Windows</option>
              <option>Front Doors</option>
              <option>Bi-fold Doors</option>
              <option>Other</option>
            </select>
            <textarea placeholder="Project Details" className={styles.formTextarea} rows={4}></textarea>

            <button type="submit" className={styles.buttonPrimary}>
              Submit Quote Request
            </button>
          </form>
        </section>

        {/* FAQ Section */}
        <section className={styles.faqSection}>
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <div className={styles.faqList}>
            {[
              {
                q: 'How long do timber windows last?',
                a: 'Our Accoya timber windows come with a 50-year anti-rot guarantee and typically last 60+ years with minimal maintenance.'
              },
              {
                q: 'Do you offer finance options?',
                a: 'Yes, we offer flexible 0% APR finance options for projects over £2,000.'
              },
              {
                q: 'What areas do you cover?',
                a: tenant.serviceAreas?.join(', ') || 'Kent, East Sussex, West Sussex'
              },
              {
                q: 'How long does installation take?',
                a: 'Most window installations take 1-3 days depending on the project size. We will provide a clear timeline with your quote.'
              },
            ].map((faq, idx) => (
              <details key={idx} className={styles.faqItem}>
                <summary className={styles.faqQuestion}>{faq.q}</summary>
                <p className={styles.faqAnswer}>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* Exit-Intent Modal */}
      {showExitIntent && (
        <div className={styles.exitModal} onClick={() => setShowExitIntent(false)}>
          <div className={styles.exitModalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.exitModalClose} onClick={() => setShowExitIntent(false)}>
              ✕
            </button>
            <h3>Wait! Before You Go...</h3>
            <p>Download our FREE guide: &quot;10 Questions to Ask Before Choosing Windows&quot;</p>
            <a
              href="/free-guide.pdf"
              className={styles.buttonPrimary}
              onClick={() => {
                track('generate_lead', { method: 'exit_intent_download', tenant_slug: tenant.slug });
                setShowExitIntent(false);
              }}
              download
            >
              Get Free Guide
            </a>
          </div>
        </div>
      )}
    </>
  );
}
