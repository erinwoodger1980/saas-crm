'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useSearchParams } from 'next/navigation';
import { BeforeAfter } from '@/components/BeforeAfter';
import { StickyBar } from '@/components/StickyBar';
import { MobileDock } from '@/components/MobileDock';
import type { TenantData } from '@/data/tenants';
import { getTenantStatic, getTenantEnrichment, mergeTenantData, getTenantGallery } from '@/data/tenants';
import { fetchTenantFromDB } from '@/lib/landing-api';
import styles from './page.module.css';

export default function TenantLandingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;

  const [tenantData, setTenantData] = useState<TenantData | null>(null);
  const [variant, setVariant] = useState<'A' | 'B'>('A');
  const [loading, setLoading] = useState(true);
  const [showExitIntent, setShowExitIntent] = useState(false);
  
  // Get keyword from query param for dynamic content
  const keyword = searchParams.get('kw') ? decodeURIComponent(searchParams.get('kw')!) : null;

  // Load tenant data
  useEffect(() => {
    async function loadData() {
      try {
        // Step 1: Try fetching from DB (published content)
        let dbData = null;
        try {
          dbData = await fetchTenantFromDB(slug, false);
        } catch (error) {
          console.warn('DB fetch failed, falling back to JSON:', error);
        }

        // Step 2: If DB has content, transform to TenantData format
        if (dbData && dbData.content?.published) {
          const transformed: TenantData = {
            name: dbData.name,
            slug: dbData.slug,
            phone: dbData.phone || '',
            email: dbData.email || '',
            address: dbData.address || '',
            homeUrl: dbData.homeUrl || '',
            logo: dbData.logoUrl || '',
            brand: {
              primary: dbData.brandColor || '#18332F',
              accent: '#C9A14A',
            },
            gallery: dbData.images.map((img: any) => ({
              src: img.src,
              alt: img.alt || '',
              caption: img.caption || '',
            })),
            reviews: dbData.reviews.map((r: any) => ({
              text: r.quote,
              author: r.author || '',
              location: r.location || '',
              stars: r.stars,
            })),
            serviceAreas: dbData.content.serviceAreas ? JSON.parse(dbData.content.serviceAreas) : [],
            priceAnchor: {
              fromText: dbData.content.priceFromText || '',
              rangeText: dbData.content.priceRange || '',
            },
            guarantees: dbData.content.guarantees ? JSON.parse(dbData.content.guarantees) : undefined,
            urgencyBanner: dbData.content.urgency ? JSON.parse(dbData.content.urgency) : undefined,
            leadMagnet: dbData.content.leadMagnet ? JSON.parse(dbData.content.leadMagnet) : undefined,
          };
          
          setTenantData(transformed);
          setLoading(false);
          return;
        }

        // Step 3: Fallback to static JSON + enrichment (original flow)
        const staticData = getTenantStatic(slug);
        if (!staticData) {
          console.error(`Tenant not found: ${slug}`);
          setLoading(false);
          return;
        }

        // Get gallery override from image importer
        const galleryOverride = await getTenantGallery(slug);

        // Get OG enrichment if enabled
        const enrichment = staticData.homeUrl 
          ? await getTenantEnrichment(staticData.homeUrl)
          : null;

        // Merge data sources
        const merged = mergeTenantData(staticData, enrichment || {}, galleryOverride);
        setTenantData(merged);
      } catch (error) {
        console.error('Failed to load tenant data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

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
    if (tenantData) {
      track('experiment_impression', {
        experiment_id: 'hero_headline_test',
        variant_id: variant,
        tenant_slug: slug,
        keyword: keyword || 'organic',
      });
    }
  }, [variant, tenantData, slug, keyword]);

  // Exit-intent detection
  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !showExitIntent) {
        setShowExitIntent(true);
        track('view_item_list', { item_list_id: 'exit_intent_modal', tenant_slug: slug });
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [showExitIntent, slug]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!tenantData) {
    return (
      <div className={styles.error}>
        <h1>Tenant Not Found</h1>
        <p>The landing page for &quot;{slug}&quot; could not be loaded.</p>
      </div>
    );
  }

  const heroHeadline = variant === 'A' 
    ? `${tenantData.name} - Expert Craftsmanship Since 1960`
    : `Transform Your Home with ${tenantData.name}`;
  
  // Use keyword-optimized headline if kw param provided
  const finalHeadline = keyword 
    ? `${keyword} Specialists in ${tenantData.serviceAreas?.[0] || 'Your Area'} | ${tenantData.name}`
    : heroHeadline;
    
  const finalSubheadline = keyword
    ? `Expert ${keyword.toLowerCase()} for homes and businesses in ${tenantData.serviceAreas?.slice(0, 3).join(', ') || 'your area'}`
    : `Bespoke timber windows and doors for ${tenantData.serviceAreas?.slice(0, 3).join(', ') || 'your area'}`;

  return (
    <>
      {/* Dynamic Meta Tags for SEO */}
      <head>
        <title>{keyword ? `${keyword} in ${tenantData.serviceAreas?.[0] || 'Your Area'} | ${tenantData.name}` : `${tenantData.name} - Expert Craftsmanship`}</title>
        <meta name="description" content={keyword ? `Looking for ${keyword.toLowerCase()}? ${tenantData.name} provides expert ${keyword.toLowerCase()} services in ${tenantData.serviceAreas?.join(', ') || 'your area'}. Get a free quote today!` : `${tenantData.name} provides bespoke timber windows and doors.`} />
      </head>
      
      <StickyBar
        brandName={tenantData.name}
        logoSrc={tenantData.logo || '/placeholder-logo.png'}
        phone={tenantData.phone}
        onGetQuoteClick={() => {
          document.getElementById('quote-form')?.scrollIntoView({ behavior: 'smooth' });
          track('select_content', { content_type: 'cta_button', item_id: 'sticky_bar_quote' });
        }}
        trackEvent={track}
      />

      <MobileDock
        phone={tenantData.phone}
        onGetQuoteClick={() => {
          document.getElementById('quote-form')?.scrollIntoView({ behavior: 'smooth' });
          track('select_content', { content_type: 'cta_button', item_id: 'mobile_dock_quote' });
        }}
        trackEvent={track}
      />

      <main className={styles.container}>
        {/* Schema.org JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'LocalBusiness',
              name: tenantData.name,
              telephone: tenantData.phone,
              email: tenantData.email,
              address: tenantData.address ? {
                '@type': 'PostalAddress',
                addressLocality: tenantData.address,
                addressCountry: 'GB',
              } : undefined,
              areaServed: tenantData.serviceAreas?.map(area => ({
                '@type': 'City',
                name: area,
              })),
              aggregateRating: tenantData.reviews?.length ? {
                '@type': 'AggregateRating',
                ratingValue: (tenantData.reviews.reduce((sum, r) => sum + (r.stars || 5), 0) / tenantData.reviews.length).toFixed(1),
                reviewCount: tenantData.reviews.length,
              } : undefined,
            }),
          }}
        />

        {/* Product Schema (3 products) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: 'Sash Windows',
                brand: { '@type': 'Brand', name: tenantData.name },
                offers: {
                  '@type': 'AggregateOffer',
                  priceCurrency: 'GBP',
                  lowPrice: tenantData.priceAnchor?.fromText?.match(/\d+/)?.[0] || '850',
                },
              },
              {
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: 'Casement Windows',
                brand: { '@type': 'Brand', name: tenantData.name },
                offers: {
                  '@type': 'AggregateOffer',
                  priceCurrency: 'GBP',
                  lowPrice: tenantData.priceAnchor?.fromText?.match(/\d+/)?.[0] || '850',
                },
              },
              {
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: 'Front Doors',
                brand: { '@type': 'Brand', name: tenantData.name },
                offers: {
                  '@type': 'AggregateOffer',
                  priceCurrency: 'GBP',
                  lowPrice: '1200',
                },
              },
            ]),
          }}
        />

        {/* Hero Section */}
        <section className={styles.hero} style={{ backgroundColor: tenantData.brand?.primary || '#18332F' }}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroHeadline}>{finalHeadline}</h1>
            <p className={styles.heroSubheadline}>
              {finalSubheadline}
            </p>
            <div className={styles.heroButtons}>
              <a
                href={`tel:${tenantData.phone}`}
                className={styles.buttonPrimary}
                onClick={() => track('click_contact_phone', { tenant_slug: slug, location: 'hero' })}
              >
                📞 Call Now: {tenantData.phone}
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
        {tenantData.urgencyBanner && (
          <div className={styles.urgencyBanner}>
            <p className={styles.urgencyText}>
              ⚡ {tenantData.urgencyBanner.text}
              {tenantData.urgencyBanner.sub && <span className={styles.urgencySub}> {tenantData.urgencyBanner.sub}</span>}
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
        {tenantData.reviews && tenantData.reviews.length > 0 && (
          <section className={styles.reviewsSection}>
            <h2 className={styles.sectionTitle}>What Our Customers Say</h2>
            <div className={styles.reviewsCarousel}>
              {tenantData.reviews.map((review, idx) => (
                <div key={idx} className={styles.reviewCard}>
                  <div className={styles.reviewStars}>
                    {'⭐'.repeat(review.stars || 5)}
                  </div>
                  <p className={styles.reviewText}>&quot;{review.text || review.quote || ''}&quot;</p>
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
        {tenantData.guarantees && (
          <section className={styles.guaranteesSection}>
            <h2 className={styles.sectionTitle}>Our Guarantees</h2>
            <ul className={styles.guaranteesList}>
              {tenantData.guarantees.bullets?.map((bullet, idx) => (
                <li key={idx} className={styles.guaranteeItem}>
                  ✅ {bullet}
                </li>
              ))}
            </ul>
            {tenantData.guarantees.riskReversal && (
              <p className={styles.riskReversal}>
                🛡️ <strong>Risk-Free:</strong> {tenantData.guarantees.riskReversal}
              </p>
            )}
          </section>
        )}

        {/* Price Anchor */}
        {tenantData.priceAnchor && (
          <section className={styles.priceSection}>
            <h2 className={styles.sectionTitle}>Transparent Pricing</h2>
            <p className={styles.priceFrom}>{tenantData.priceAnchor.fromText}</p>
            {tenantData.priceAnchor.rangeText && (
              <p className={styles.priceRange}>{tenantData.priceAnchor.rangeText}</p>
            )}
          </section>
        )}

        {/* Gallery with Before/After */}
        {tenantData.gallery && tenantData.gallery.length >= 2 && (
          <section className={styles.gallerySection}>
            <h2 className={styles.sectionTitle}>Our Work</h2>
            <div className={styles.galleryGrid}>
              {tenantData.gallery.slice(0, 2).map((img, idx) => (
                <div key={idx} className={styles.galleryItem}>
                  {img.before && img.after ? (
                    <BeforeAfter
                      beforeSrc={img.before}
                      afterSrc={img.after}
                      beforeAlt={img.beforeAlt || 'Before'}
                      afterAlt={img.afterAlt || 'After'}
                    />
                  ) : (
                    <Image
                      src={img.src || img.after || img.before || '/placeholder.jpg'}
                      alt={img.alt || img.afterAlt || img.beforeAlt || 'Project'}
                      width={600}
                      height={400}
                      className={styles.galleryImage}
                    />
                  )}
                  {img.caption && <p className={styles.galleryCaption}>{img.caption}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Lead Magnet */}
        {tenantData.leadMagnet && (
          <section className={styles.leadMagnetSection}>
            <div className={styles.leadMagnetCard}>
              <h3 className={styles.leadMagnetTitle}>📥 {tenantData.leadMagnet.title}</h3>
              <a
                href={tenantData.leadMagnet.url || '/brochure.pdf'}
                className={styles.buttonPrimary}
                onClick={() => track('generate_lead', { 
                  method: 'download_brochure',
                  tenant_slug: slug,
                  lead_type: 'content_download',
                })}
                download
              >
                {tenantData.leadMagnet.cta || 'Download Now'}
              </a>
            </div>
          </section>
        )}

        {/* Enhanced Quote Form */}
        <section id="quote-form" className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Get Your Free Quote</h2>
          <form className={styles.quoteForm} onSubmit={(e) => {
            e.preventDefault();
            track('generate_lead', {
              method: 'quote_form',
              tenant_slug: slug,
              lead_type: 'quote_request',
              form_fields: 5,
            });
            alert('Form submitted! (Demo)');
          }}>
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
            
            {/* File Upload */}
            <div className={styles.formFile}>
              <label htmlFor="file-upload" className={styles.fileLabel}>
                📎 Attach Photos (optional)
              </label>
              <input id="file-upload" type="file" multiple accept="image/*" className={styles.fileInput} />
            </div>

            {/* Callback Toggle */}
            <label className={styles.formCheckbox}>
              <input type="checkbox" />
              <span>I'd prefer a callback at a specific time</span>
            </label>

            {/* GDPR Consent */}
            <label className={styles.formCheckbox}>
              <input type="checkbox" required />
              <span>I consent to {tenantData.name} storing my details for this quote *</span>
            </label>

            <button
              type="submit"
              className={styles.buttonPrimary}
              onClick={() => track('begin_checkout', { tenant_slug: slug, form_location: 'quote_form' })}
            >
              Submit Quote Request
            </button>
          </form>
        </section>

        {/* FAQ Section */}
        <section className={styles.faqSection}>
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <div className={styles.faqList}>
            {[
              { q: 'How long do timber windows last?', a: 'Our Accoya timber windows come with a 50-year anti-rot guarantee and typically last 60+ years with minimal maintenance.' },
              { q: 'Do you offer finance options?', a: 'Yes, we offer flexible 0% APR finance options for projects over £2,000.' },
              { q: 'What areas do you cover?', a: tenantData.serviceAreas?.join(', ') || 'Kent, East Sussex, West Sussex' },
              { q: 'How long does installation take?', a: 'Most window installations take 1-3 days depending on the project size. We will provide a clear timeline with your quote.' },
            ].map((faq, idx) => (
              <details key={idx} className={styles.faqItem}>
                <summary className={styles.faqQuestion}>{faq.q}</summary>
                <p className={styles.faqAnswer}>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* FAQ Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                { '@type': 'Question', name: 'How long do timber windows last?', acceptedAnswer: { '@type': 'Answer', text: 'Our Accoya timber windows come with a 50-year anti-rot guarantee and typically last 60+ years with minimal maintenance.' }},
                { '@type': 'Question', name: 'Do you offer finance options?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, we offer flexible 0% APR finance options for projects over £2,000.' }},
                { '@type': 'Question', name: 'What areas do you cover?', acceptedAnswer: { '@type': 'Answer', text: tenantData.serviceAreas?.join(', ') || 'Kent, East Sussex, West Sussex' }},
                { '@type': 'Question', name: 'How long does installation take?', acceptedAnswer: { '@type': 'Answer', text: 'Most window installations take 1-3 days depending on the project size.' }},
              ],
            }),
          }}
        />

        {/* Footer */}
        <footer className={styles.footer}>
          <p>&copy; {new Date().getFullYear()} {tenantData.name}. All rights reserved.</p>
          {tenantData.address && (
            <p className={styles.footerAddress}>
              {tenantData.address}
            </p>
          )}
          <p className={styles.footerContact}>
            📞 {tenantData.phone} | ✉️ {tenantData.email}
          </p>
        </footer>
      </main>

      {/* Exit-Intent Modal */}
      {showExitIntent && (
        <div className={styles.exitModal} onClick={() => setShowExitIntent(false)}>
          <div className={styles.exitModalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.exitModalClose} onClick={() => setShowExitIntent(false)}>✕</button>
            <h3>Wait! Before You Go...</h3>
            <p>Download our FREE guide: &quot;10 Questions to Ask Before Choosing Windows&quot;</p>
            <a
              href="/free-guide.pdf"
              className={styles.buttonPrimary}
              onClick={() => {
                track('generate_lead', { method: 'exit_intent_download', tenant_slug: slug });
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
