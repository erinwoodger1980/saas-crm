'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Phone, Mail, MapPin, Star, Check, Download, ChevronDown, X, MessageCircle } from 'lucide-react';
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

      {/* FAQ Schema */}
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
                name: 'Do you offer finance options?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes, we offer flexible 0% APR finance options for projects over £2,000.',
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
      <header
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
              onClick={() => track('click_contact_phone', { location: 'header' })}
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
              onClick={() => track('click_contact_phone', { location: 'header_mobile' })}
            >
              <Phone className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center justify-center bg-gradient-to-br from-amber-900 via-amber-800 to-stone-900 text-white overflow-hidden">
          {/* Background Image */}
          {images[0]?.url && (
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
                onClick={() => track('click_contact_phone', { location: 'hero' })}
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
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <ChevronDown className="w-8 h-8 text-white opacity-50" />
          </div>
        </section>

        {/* Urgency Banner */}
        {urgency && (
          <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white py-4 text-center shadow-lg">
            <p className="font-semibold text-lg">
              {urgency.text}
              {urgency.sub && <span className="ml-2 text-sm opacity-95">• {urgency.sub}</span>}
            </p>
          </div>
        )}

        {/* Trust Strip */}
        <section className="py-12 bg-gray-50 border-y">
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
          <section className="py-20 bg-gradient-to-b from-white to-amber-50">
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
                {reviews.slice(0, 6).map((review, idx) => (
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

        {/* Gallery Section */}
        {images.length > 0 && (
          <section className="py-20 bg-gray-50">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
                View Recent Projects
              </h2>
              
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
            </div>
          </section>
        )}

        {/* Guarantees & Pricing */}
        {guarantees && (
          <section className="py-20 bg-gradient-to-br from-amber-50 via-white to-stone-50">
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
                    {guarantees.bullets?.map((bullet: string, idx: number) => (
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

                {/* Pricing */}
                <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-stone-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-stone-100 rounded-full">
                      <span className="text-2xl">💷</span>
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">Investment Guide</h2>
                  </div>
                  <div className="space-y-4">
                    <div className="p-6 bg-gradient-to-br from-amber-50 to-stone-50 rounded-xl border border-amber-200 hover:shadow-md transition">
                      <div className="text-sm text-amber-800 mb-2 font-semibold">Premium Oak Sash Windows from</div>
                      <div className="text-4xl font-bold text-amber-900">£2,500</div>
                      <p className="text-xs text-amber-700 mt-2">Per window, fully installed</p>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-stone-50 to-amber-50 rounded-xl border border-stone-200 hover:shadow-md transition">
                      <div className="text-sm text-stone-700 mb-2 font-semibold">Typical Full Project</div>
                      <div className="text-2xl font-bold text-stone-900">£8,000 - £25,000</div>
                      <p className="text-xs text-stone-600 mt-2">Complete home transformation</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-900">
                        <span className="font-semibold">0% Finance Available</span> on projects over £2,000
                      </p>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      *Final price depends on timber grade, size, specification, and installation complexity.
                      Every project is bespoke and quoted individually.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

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
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    track('generate_lead', { method: 'quote_form' });
                    alert('Form submitted! (Demo)');
                  }}
                  className="space-y-4"
                >
                  <div className="grid md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Full Name *"
                      required
                      className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                    <input
                      type="email"
                      placeholder="Email *"
                      required
                      className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <input
                      type="tel"
                      placeholder="Phone *"
                      required
                      className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                    <input
                      type="text"
                      placeholder="Postcode *"
                      required
                      className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </div>
                  
                  <select
                    required
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
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-lg py-7 shadow-xl font-bold"
                  >
                    Get My Free Quote →
                  </Button>
                  
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <p className="text-xs text-center text-amber-900">
                      ⚡ <span className="font-semibold">Quick Response:</span> We typically respond within 2 hours during business hours
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Frequently Asked Questions
            </h2>
            
            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem value="item-1" className="bg-white rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  How long do timber windows last?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  Our Accoya timber windows come with a 50-year anti-rot guarantee and typically last 60+ years with minimal maintenance. They're designed to outperform uPVC and aluminium alternatives.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-2" className="bg-white rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  Do you offer finance options?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  Yes, we offer flexible 0% APR finance options for projects over £2,000. Speak to our team for details.
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
                  {serviceAreas.map((area, idx) => (
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
        <a href={`tel:${tenant.phone}`} className="flex-1">
          <Button className="w-full bg-stone-800 hover:bg-stone-700 text-white font-semibold" onClick={() => track('click_contact_phone', { location: 'mobile_sticky' })}>
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
                <Button
                  size="lg"
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    track('generate_lead', { method: 'exit_intent_download' });
                    setShowExitIntent(false);
                    window.open('/guide.pdf', '_blank');
                  }}
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download Free Guide
                </Button>
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
