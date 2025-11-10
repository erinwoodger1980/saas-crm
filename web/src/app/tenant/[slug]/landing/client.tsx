'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Phone, Mail, MapPin, Star, Check, Download, ChevronDown, X, MessageCircle, Image as ImageIcon, Hammer, Ruler, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface PublicLandingClientProps {
  tenant: any;
  headline: string;
  subheadline: string;
  keyword?: string;
  location: string;
  serviceAreas: string[];
  images: any[];
  reviews: any[];
  guarantees: any;
  urgency: any;
  leadMagnet: any;
}

export function PublicLandingClient({
  tenant,
  headline,
  subheadline,
  keyword: _keyword,
  location,
  serviceAreas,
  images,
  reviews,
  guarantees,
  urgency,
  leadMagnet: _leadMagnet,
}: PublicLandingClientProps) {
  const [showExitIntent, setShowExitIntent] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const hasImages = Array.isArray(images) && images.length > 0;

  // Scroll detection for sticky header
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Exit intent detection
  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !showExitIntent) {
        setShowExitIntent(true);
        track('view_item_list', { item_list_id: 'exit_intent_modal' });
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
    // track is stable in this component; only showExitIntent should trigger re-subscription
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExitIntent]);

  // Analytics tracking
  const track = (eventName: string, params?: Record<string, any>) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, {
        tenant_slug: tenant.slug,
        ...params,
      });
    }
  };

  const scrollToForm = () => {
    document.getElementById('quote-form')?.scrollIntoView({ behavior: 'smooth' });
    track('select_content', { content_type: 'cta_button' });
  };

  // Create a landing lead via the public capture endpoint
  async function createPublicLead(input: {
    source: string;
    name?: string;
    email?: string;
    phone?: string;
    postcode?: string;
    projectType?: string;
    propertyType?: string;
    message?: string;
  }) {
    try {
      const res = await fetch('/api/leads/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        console.warn('[landing] lead capture failed', res.status, json);
        return { ok: false };
      }
      return { ok: true, id: json.id as string | undefined };
    } catch (e: any) {
      console.warn('[landing] lead capture error', e?.message || e);
      return { ok: false };
    }
  }

  // Phone click → create a lightweight phone-only lead (non-blocking)
  async function handlePhoneClick(locationTag: string) {
    try {
      track('click_contact_phone', { location: locationTag });
      if (!tenant?.phone) return;
      // Fire and forget; don't block the call
      createPublicLead({ source: 'landing-phone', phone: tenant.phone, name: 'Phone Enquiry' });
    } catch {}
  }

  const avgRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + (r.rating || r.stars || 5), 0) / reviews.length).toFixed(1)
    : '5.0';

  return (
    <>
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            name: tenant.name,
            telephone: tenant.phone,
            email: tenant.email,
            address: {
              '@type': 'PostalAddress',
              addressLocality: location,
              addressCountry: 'GB',
            },
            areaServed: serviceAreas.map(area => ({ '@type': 'City', name: area })),
            aggregateRating: reviews.length ? {
              '@type': 'AggregateRating',
              ratingValue: avgRating,
              reviewCount: reviews.length,
            } : undefined,
            openingHours: 'Mo-Fr 09:00-17:00',
          }),
        }}
      />

      {/* FAQ Schema (finance question removed) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'How long do timber windows last?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Our Accoya timber windows come with a 50-year anti-rot guarantee and typically last 60+ years with minimal maintenance.',
                },
              },
              {
                '@type': 'Question',
                name: 'What areas do you cover?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: serviceAreas.join(', '),
                },
              },
            ],
          }),
        }}
      />

      {/* Fixed Sticky Header */}
  <header id="hero"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white shadow-lg py-3' : 'bg-white/95 backdrop-blur-sm py-4'
        }`}
      >
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tenant.logoUrl && (
              <Image src={tenant.logoUrl} alt={tenant.name} width={50} height={50} className="object-contain" />
            )}
            <span className="font-bold text-lg text-gray-900">{tenant.name}</span>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <a
              href={`tel:${tenant.phone}`}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition"
              onClick={() => handlePhoneClick('header')}
            >
              <Phone className="w-5 h-5" />
              <span className="font-semibold">{tenant.phone}</span>
            </a>
            <Button
              onClick={scrollToForm}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-md"
            >
              Get Free Quote
            </Button>
          </div>

          {/* Mobile CTA */}
          <div className="md:hidden flex items-center gap-2">
            <a
              href={`tel:${tenant.phone}`}
              className="p-2 bg-amber-600 text-white rounded-full shadow-md"
              onClick={() => handlePhoneClick('header_mobile')}
            >
              <Phone className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20">
        {/* Hero Section */}
  <section id="hero-main" className="relative min-h-[90vh] flex items-center justify-center bg-gradient-to-br from-amber-900 via-amber-800 to-stone-900 text-white overflow-hidden">
          {/* Background Image */}
          {hasImages && images[0]?.url && (
            <div className="absolute inset-0 opacity-40">
              <Image
                src={images[0].url}
                alt="Hero background"
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
          
          {/* Wood Grain Texture Overlay */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h60v60H0V0zm30 30h30v30H30V30z' fill='%23000000' fill-opacity='0.1'/%3E%3C/svg%3E")`,
            backgroundSize: '120px 120px'
          }}></div>
          
          {/* Hero Content */}
          <div className="relative z-10 container mx-auto px-4 text-center animate-fade-in">
            <div className="inline-block px-4 py-2 bg-amber-600/30 backdrop-blur-sm rounded-full mb-6 border border-amber-400/30">
              <span className="text-amber-100 text-sm font-semibold">🏡 Hand-Crafted by Master Craftsmen</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight drop-shadow-lg">
              {headline}
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-amber-50 max-w-3xl mx-auto drop-shadow">
              {subheadline}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                onClick={scrollToForm}
                className="bg-amber-600 hover:bg-amber-700 text-white text-lg px-10 py-7 font-bold shadow-2xl hover:scale-105 transition-transform"
              >
                Get My Free Quote →
              </Button>
              <a
                href={`tel:${tenant.phone}`}
                onClick={() => handlePhoneClick('hero')}
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white/15 backdrop-blur-sm border-2 border-white hover:bg-white/25 text-white text-lg px-8 py-7 font-semibold shadow-xl"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Call {tenant.phone}
                </Button>
              </a>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex flex-wrap justify-center items-center gap-4 text-sm text-gray-300">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{avgRating} rating from {reviews.length}+ customers</span>
              </div>
              <span>•</span>
              <span>Serving {serviceAreas.slice(0, 3).join(', ')}</span>
            </div>

            {!hasImages && (
              <div className="mt-6 text-sm text-amber-100/90">
                No project photos yet. Owner? <a href={`/admin/tenants/${tenant.id}/edit?tab=gallery`} className="underline font-semibold hover:text-white">Upload your images</a> to showcase your work.
              </div>
            )}
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <ChevronDown className="w-8 h-8 text-white opacity-50" />
          </div>
        </section>

        {/* Urgency Banner */}
        {(!urgency) && (
          <div className="bg-gradient-to-r from-amber-900 via-stone-800 to-amber-900 text-white py-4 text-center shadow-inner">
            <p className="font-semibold text-sm md:text-base">
              November Installation Slots: <span className="text-amber-300 font-bold">3 remaining</span> • Book now to secure pre-Christmas completion
            </p>
          </div>
        )}
        {urgency && (
          <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white py-4 text-center shadow-lg">
            <p className="font-semibold text-lg">
              {urgency.text}
              {urgency.sub && <span className="ml-2 text-sm opacity-95">• {urgency.sub}</span>}
            </p>
          </div>
        )}

        {/* Trust Strip */}
  <section id="trust" className="py-12 bg-gray-50 border-y">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
              <TrustBadge src="/trust-fensa.png" alt="FENSA Approved" />
              <TrustBadge src="/trust-pas24.png" alt="PAS 24 Certified" />
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">50 Year</div>
                <div className="text-sm text-gray-600">Guarantee</div>
              </div>
              <TrustBadge src="/trust-accoya.png" alt="Accoya Wood" />
            </div>
          </div>
        </section>

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <section id="reviews" className="py-20 bg-gradient-to-b from-white to-amber-50">
            <div className="container mx-auto px-4">
              <div className="text-center mb-12">
                <div className="inline-block px-6 py-2 bg-amber-100 rounded-full mb-4">
                  <span className="text-amber-800 font-semibold">⭐ Trusted by Homeowners Across the South East</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                  What Our Customers Say
                </h2>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                {Array.isArray(reviews) && reviews.slice(0, 6).map((review, idx) => (
                  <Card key={idx} className="hover:shadow-xl transition-all hover:-translate-y-1 border-2 border-amber-100 bg-white">
                    <CardContent className="p-6">
                      <div className="flex gap-1 mb-4">
                        {[...Array(review.rating || review.stars || 5)].map((_, i) => (
                          <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-gray-700 mb-5 italic leading-relaxed">
                        &quot;{review.text || review.quote}&quot;
                      </p>
                      <div className="border-t pt-4 border-amber-100">
                        <div className="text-sm font-bold text-gray-900">
                          {review.author}
                        </div>
                        {review.location && (
                          <div className="text-sm text-amber-700 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {review.location}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Process Timeline */}
  <section id="process" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl border p-6 text-center shadow-sm">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center"><Phone className="text-amber-700" /></div>
                <h3 className="font-semibold mb-1">1. Quick Call</h3>
                <p className="text-sm text-gray-600">We learn about your home and goals.</p>
              </div>
              <div className="bg-white rounded-xl border p-6 text-center shadow-sm">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center"><Ruler className="text-amber-700" /></div>
                <h3 className="font-semibold mb-1">2. Site Survey</h3>
                <p className="text-sm text-gray-600">Detailed measurements and specification.</p>
              </div>
              <div className="bg-white rounded-xl border p-6 text-center shadow-sm">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center"><Hammer className="text-amber-700" /></div>
                <h3 className="font-semibold mb-1">3. Craft & Install</h3>
                <p className="text-sm text-gray-600">Hand-built joinery, fitted by experts.</p>
              </div>
              <div className="bg-white rounded-xl border p-6 text-center shadow-sm">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center"><Home className="text-amber-700" /></div>
                <h3 className="font-semibold mb-1">4. Aftercare</h3>
                <p className="text-sm text-gray-600">50-year anti-rot guarantee, zero stress.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Gallery Section */}
  <section id="gallery" className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              View Recent Projects
            </h2>

            {hasImages ? (
              <div className="grid md:grid-cols-3 gap-4">
                {images.slice(0, 6).map((img, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition"
                    onClick={() => setSelectedImage(idx)}
                  >
                    <Image
                      src={img.url}
                      alt={img.altText || `Project ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="relative aspect-[4/3] rounded-lg border-2 border-dashed border-amber-200 bg-white flex items-center justify-center text-amber-700">
                      <div className="flex flex-col items-center gap-2">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-sm font-medium">Project photo placeholder</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  {tenant?.id ? (
                    <a href={`/admin/tenants/${tenant.id}/edit?tab=gallery`}>
                      <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-50">
                        Owner? Upload your photos →
                      </Button>
                    </a>
                  ) : (
                    <Button disabled variant="outline" className="border-amber-300 text-amber-400">
                      Upload (login required)
                    </Button>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {tenant?.id
                      ? 'Images appear instantly after upload. They help build trust and drive conversions.'
                      : 'Log in as the business owner to upload project photos.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Guarantees & Pricing */}
        {guarantees && (
          <section id="guarantees" className="py-20 bg-gradient-to-br from-amber-50 via-white to-stone-50">
            <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
                {/* Guarantees */}
                <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-amber-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-100 rounded-full">
                      <Check className="w-6 h-6 text-amber-700" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">Our Guarantees</h2>
                  </div>
                  <ul className="space-y-4">
                    {Array.isArray(guarantees.bullets) && guarantees.bullets.map((bullet: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3 group">
                        <Check className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1 group-hover:scale-110 transition-transform" />
                        <span className="text-gray-700 text-lg leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  {guarantees.riskReversal && (
                    <div className="mt-8 p-5 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg border-l-4 border-amber-600">
                      <p className="text-amber-900">
                        <span className="font-bold">Risk-Free Promise:</span> {guarantees.riskReversal}
                      </p>
                    </div>
                  )}
                </div>

                {/* Pricing removed per request */}
              </div>
            </div>
          </section>
        )}

  {/* Comparison Section */}
  <section id="comparison" className="py-16 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">Timber vs uPVC</h2>
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-left">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="p-4 text-sm font-semibold text-stone-700">Feature</th>
                    <th className="p-4 text-sm font-semibold text-stone-700">Premium Timber</th>
                    <th className="p-4 text-sm font-semibold text-stone-700">uPVC</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    { f: 'Lifespan', t: '60+ years', u: '20-30 years' },
                    { f: 'Maintenance', t: 'Low with Accoya', u: 'Can discolor/warp' },
                    { f: 'Thermal Performance', t: 'Excellent with double/triple glazing', u: 'Good' },
                    { f: 'Aesthetics', t: 'Natural wood grain, heritage look', u: 'Plastic appearance' },
                    { f: 'Sustainability', t: 'Renewable, FSC-certified timber', u: 'Plastic-based' },
                    { f: 'Resale Value', t: 'Adds character and value', u: 'Neutral' },
                  ].map((row, idx) => (
                    <tr key={idx} className="bg-white">
                      <td className="p-4 font-medium text-stone-900">{row.f}</td>
                      <td className="p-4 text-stone-700">{row.t}</td>
                      <td className="p-4 text-stone-700">{row.u}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

  {/* Lead Magnet */}
  <section id="guide" className="py-16 bg-gradient-to-r from-amber-50 to-stone-50">
          <div className="container mx-auto px-4 max-w-3xl">
            <Card className="border-2 border-amber-200">
              <CardContent className="p-8">
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">Free Guide: 10 Questions Before You Buy</h3>
                  <p className="text-stone-700 mb-6">Make a confident decision with our 5-minute buyers guide.</p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget as HTMLFormElement;
                      const email = (form.elements.namedItem('guide-email') as HTMLInputElement)?.value.trim();
                      if (!email) return;
                      
                      // Create lead for guide download
                      const resp = await createPublicLead({
                        source: 'landing-guide',
                        email,
                        name: 'Guide Download',
                      });
                      
                      if (resp.ok) {
                        track('generate_lead', { method: 'lead_magnet', status: 'success' });
                        // Trigger download
                        const link = document.createElement('a');
                        link.href = '/free-guide.pdf';
                        link.download = 'joinery-buying-guide.pdf';
                        link.click();
                        form.reset();
                      } else {
                        track('generate_lead', { method: 'lead_magnet', status: 'error' });
                        alert('Sorry, something went wrong. Please try again or contact us directly.');
                      }
                    }}
                    className="grid md:grid-cols-3 gap-3"
                  >
                    <input type="email" name="guide-email" required placeholder="Your email" className="md:col-span-2 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-600" />
                    <Button type="submit" className="bg-amber-600 hover:bg-amber-700">Get the Guide</Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Lead Form Section */}
        <section id="quote-form" className="py-20 bg-gradient-to-br from-amber-800 via-amber-700 to-stone-800 text-white relative overflow-hidden">
          {/* Decorative wood grain pattern */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0 L100 0 L100 5 L0 5 Z M0 20 L100 20 L100 23 L0 23 Z M0 40 L100 40 L100 44 L0 44 Z M0 60 L100 60 L100 62 L0 62 Z M0 80 L100 80 L100 85 L0 85 Z' fill='%23000000'/%3E%3C/svg%3E")`
          }}></div>
          
          <div className="container mx-auto px-4 max-w-2xl relative z-10">
            <div className="text-center mb-8">
              <div className="inline-block px-6 py-3 bg-amber-600/40 backdrop-blur-sm rounded-full mb-4 border border-amber-400/40">
                <span className="text-amber-50 font-semibold">✨ Start Your Project Today</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 drop-shadow-lg">
                Get Your Free Quote
              </h2>
              <p className="text-amber-100 mb-2 text-lg">
                Takes 2 minutes • No obligation • Expert advice
              </p>
              <p className="text-amber-200 text-sm">
                📞 Or call us now: <a href={`tel:${tenant.phone}`} className="font-bold hover:text-white transition">{tenant.phone}</a>
              </p>
            </div>
            
            <Card className="bg-white shadow-2xl">
              <CardContent className="p-6 md:p-8">
                {formStatus === 'success' ? (
                  <div className="space-y-4 text-center">
                    <h3 className="text-2xl font-bold text-stone-900">Thanks! Your request has been received.</h3>
                    <p className="text-stone-600">We'll be in touch shortly. If it's urgent, call us on <a href={`tel:${tenant.phone}`} className="underline font-semibold">{tenant.phone}</a>.</p>
                  </div>
                ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setFormError(null);
                    setFormStatus('submitting');
                    const form = e.currentTarget as HTMLFormElement;
                    const fd = new FormData(form);
                    const name = (fd.get('name') as string || '').trim();
                    const email = (fd.get('email') as string || '').trim();
                    const phone = (fd.get('phone') as string || '').trim();
                    const postcode = (fd.get('postcode') as string || '').trim();
                    const projectType = (fd.get('interest') as string || '').trim();
                    const message = (fd.get('message') as string || '').trim();
                    const resp = await createPublicLead({
                      source: 'landing-form',
                      name,
                      email,
                      phone,
                      postcode,
                      projectType,
                      message,
                    });
                    if (resp.ok) {
                      track('generate_lead', { method: 'quote_form', status: 'success' });
                      setFormStatus('success');
                      form.reset();
                    } else {
                      track('generate_lead', { method: 'quote_form', status: 'error' });
                      setFormError('Sorry, something went wrong. Please try again or call us.');
                      setFormStatus('error');
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="grid md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      name="name"
                      placeholder="Full Name *"
                      required
                      className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                    <input
                      type="email"
                      name="email"
                      placeholder="Email *"
                      required
                      className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <input
                      type="tel"
                      name="phone"
                      placeholder="Phone *"
                      required
                      className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                    <input
                      type="text"
                      name="postcode"
                      placeholder="Postcode *"
                      required
                      className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </div>
                  
                  <select
                    required
                    name="interest"
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  >
                    <option value="">What are you interested in? *</option>
                    <option>Sash Windows</option>
                    <option>Casement Windows</option>
                    <option>Front Doors</option>
                    <option>Bi-fold Doors</option>
                    <option>Conservatory</option>
                    <option>Other</option>
                  </select>
                  
                  <textarea
                    name="message"
                    placeholder="Tell us about your project (optional)"
                    rows={4}
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                  
                  <label className="flex items-start gap-2 text-sm text-gray-600">
                    <input type="checkbox" required className="mt-1" />
                    <span>
                      I consent to {tenant.name} storing my details for this quote. 
                      See our <a href="/privacy" className="underline">privacy policy</a>.
                    </span>
                  </label>
                  
                  <Button
                    type="submit"
                    size="lg"
                    disabled={formStatus === 'submitting'}
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-lg py-7 shadow-xl font-bold disabled:opacity-70"
                  >
                    {formStatus === 'submitting' ? 'Submitting…' : 'Get My Free Quote →'}
                  </Button>
                  {formError && (
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-red-800 text-sm text-center">
                      {formError}
                    </div>
                  )}
                  
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <p className="text-xs text-center text-amber-900">
                      ⚡ <span className="font-semibold">Quick Response:</span> We typically respond within 2 hours during business hours
                    </p>
                  </div>
                </form>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Project Examples removed per request */}

  {/* FAQ Section */}
  <section id="faq" className="py-20 bg-gray-50">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Frequently Asked Questions
            </h2>
            
            <Accordion type="multiple" defaultValue={["item-1"]} className="space-y-4">
              <AccordionItem value="item-1" className="bg-white rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  How long do timber windows last?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  Our Accoya timber windows come with a 50-year anti-rot guarantee and typically last 60+ years with minimal maintenance. They're designed to outperform uPVC and aluminium alternatives.
                </AccordionContent>
              </AccordionItem>
              
              
              <AccordionItem value="item-3" className="bg-white rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  What areas do you cover?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  We serve {serviceAreas.join(', ')}. Contact us to confirm we cover your specific postcode.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-4" className="bg-white rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  How long does installation take?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  Most window installations take 1-3 days depending on the project size. We'll provide a clear timeline with your quote.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gradient-to-b from-stone-900 to-stone-950 text-white py-12 border-t-4 border-amber-600">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8 mb-8">
              {/* Company Info */}
              <div>
                <h3 className="font-bold text-lg mb-4">{tenant.name}</h3>
                <div className="space-y-2 text-gray-400">
                  {tenant.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-5 h-5 flex-shrink-0 mt-1" />
                      <span>{tenant.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5" />
                    <a href={`tel:${tenant.phone}`} className="hover:text-white transition">
                      {tenant.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    <a href={`mailto:${tenant.email}`} className="hover:text-white transition">
                      {tenant.email}
                    </a>
                  </div>
                </div>
              </div>

              {/* Service Areas */}
              <div>
                <h3 className="font-bold text-lg mb-4">Service Areas</h3>
                <div className="text-gray-400 space-y-1">
                  {Array.isArray(serviceAreas) && serviceAreas.map((area, idx) => (
                    <div key={idx}>{area}</div>
                  ))}
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h3 className="font-bold text-lg mb-4">Quick Links</h3>
                <div className="space-y-2 text-gray-400">
                  <a href="#quote-form" className="block hover:text-white transition">
                    Get a Quote
                  </a>
                  <a href="/privacy" className="block hover:text-white transition">
                    Privacy Policy
                  </a>
                  <a href="/terms" className="block hover:text-white transition">
                    Terms & Conditions
                  </a>
                </div>
              </div>
            </div>

            <div className="border-t border-stone-800 pt-8 text-center text-stone-400 text-sm">
              <p>© {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
              <p className="mt-2 flex items-center justify-center gap-2">
                <span className="text-amber-500">✨</span>
                Campaign powered by <span className="text-amber-400 font-semibold">Joinery AI</span>
              </p>
            </div>
          </div>
        </footer>
      </main>

      {/* WhatsApp Button */}
      {tenant.whatsapp && (
        <a
          href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg z-40 transition"
          onClick={() => track('click_whatsapp')}
        >
          <MessageCircle className="w-6 h-6" />
        </a>
      )}

      {/* Mobile Sticky CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-stone-900 to-amber-900 border-t-2 border-amber-600 shadow-2xl p-4 z-40 flex gap-3">
        <a href={`tel:${tenant.phone}`} className="flex-1" onClick={() => handlePhoneClick('mobile_sticky')}>
          <Button className="w-full bg-stone-800 hover:bg-stone-700 text-white font-semibold">
            <Phone className="w-5 h-5 mr-2" />
            Call Now
          </Button>
        </a>
        <Button onClick={scrollToForm} className="flex-1 bg-amber-600 hover:bg-amber-700 font-semibold">
          Get Quote
        </Button>
      </div>

      {/* Exit Intent Modal */}
      {showExitIntent && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowExitIntent(false)}
        >
          <Card className="max-w-md w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-8 relative">
              <button
                onClick={() => setShowExitIntent(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-4">Before You Go...</h3>
                <p className="text-gray-600 mb-6">
                  Download our FREE guide: &quot;10 Questions to Ask Before Choosing Windows&quot;
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget as HTMLFormElement;
                    const email = (form.elements.namedItem('exit-email') as HTMLInputElement)?.value.trim();
                    if (!email) return;
                    
                    const resp = await createPublicLead({
                      source: 'landing-exit-guide',
                      email,
                      name: 'Exit Guide Download',
                    });
                    
                    if (resp.ok) {
                      track('generate_lead', { method: 'exit_intent_download', status: 'success' });
                      const link = document.createElement('a');
                      link.href = '/free-guide.pdf';
                      link.download = 'joinery-buying-guide.pdf';
                      link.click();
                      setShowExitIntent(false);
                    } else {
                      track('generate_lead', { method: 'exit_intent_download', status: 'error' });
                      alert('Sorry, something went wrong. Please try again.');
                    }
                  }}
                  className="space-y-4"
                >
                  <input
                    type="email"
                    name="exit-email"
                    required
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-600"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download Free Guide
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lightbox */}
      {selectedImage !== null && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <X className="w-8 h-8" />
          </button>
          <div className="relative w-full max-w-5xl aspect-[4/3]">
            <Image
              src={images[selectedImage].url}
              alt={images[selectedImage].altText || 'Gallery image'}
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}

function TrustBadge({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative w-24 h-16 opacity-60 hover:opacity-100 transition">
      <Image src={src} alt={alt} fill className="object-contain" />
    </div>
  );
}
