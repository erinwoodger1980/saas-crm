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
  keyword,
  location,
  serviceAreas,
  images,
  reviews,
  guarantees,
  urgency,
  leadMagnet,
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
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Get Free Quote
            </Button>
          </div>

          {/* Mobile CTA */}
          <div className="md:hidden flex items-center gap-2">
            <a
              href={`tel:${tenant.phone}`}
              className="p-2 bg-green-600 text-white rounded-full"
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
        <section className="relative min-h-[90vh] flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
          {/* Background Image */}
          {images[0]?.url && (
            <div className="absolute inset-0 opacity-30">
              <Image
                src={images[0].url}
                alt="Hero background"
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
          
          {/* Hero Content */}
          <div className="relative z-10 container mx-auto px-4 text-center animate-fade-in">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              {headline}
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-gray-200 max-w-3xl mx-auto">
              {subheadline}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                onClick={scrollToForm}
                className="bg-green-600 hover:bg-green-700 text-white text-lg px-8 py-6"
              >
                Get My Free Quote
              </Button>
              <a
                href={`tel:${tenant.phone}`}
                onClick={() => track('click_contact_phone', { location: 'hero' })}
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white/10 backdrop-blur-sm border-white hover:bg-white/20 text-white text-lg px-8 py-6"
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
          <div className="bg-red-600 text-white py-3 text-center">
            <p className="font-semibold">
              ⚡ {urgency.text}
              {urgency.sub && <span className="ml-2 text-sm opacity-90">{urgency.sub}</span>}
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
          <section className="py-20 bg-white">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
                What Our Customers Say
              </h2>
              
              <div className="grid md:grid-cols-3 gap-6">
                {reviews.slice(0, 6).map((review, idx) => (
                  <Card key={idx} className="hover:shadow-lg transition">
                    <CardContent className="p-6">
                      <div className="flex gap-1 mb-3">
                        {[...Array(review.rating || review.stars || 5)].map((_, i) => (
                          <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <p className="text-gray-700 mb-4 italic">
                        &quot;{review.text || review.quote}&quot;
                      </p>
                      <div className="text-sm font-semibold text-gray-900">
                        {review.author}
                      </div>
                      {review.location && (
                        <div className="text-sm text-gray-500">{review.location}</div>
                      )}
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
          <section className="py-20 bg-white">
            <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
                {/* Guarantees */}
                <div>
                  <h2 className="text-3xl font-bold mb-6">Our Guarantees</h2>
                  <ul className="space-y-3">
                    {guarantees.bullets?.map((bullet: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                        <span className="text-gray-700">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  {guarantees.riskReversal && (
                    <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-green-900">
                        <span className="font-semibold">Risk-Free:</span> {guarantees.riskReversal}
                      </p>
                    </div>
                  )}
                </div>

                {/* Pricing */}
                <div>
                  <h2 className="text-3xl font-bold mb-6">Transparent Pricing</h2>
                  <div className="space-y-4">
                    <div className="p-6 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-2">Sash Windows from</div>
                      <div className="text-4xl font-bold text-gray-900">£2,500</div>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-2">Most projects</div>
                      <div className="text-2xl font-bold text-gray-900">£8,000 - £25,000</div>
                    </div>
                    <p className="text-sm text-gray-600">
                      *Final price depends on size, specification, and installation complexity.
                      Get your accurate quote today.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Lead Form Section */}
        <section id="quote-form" className="py-20 bg-gradient-to-br from-green-600 to-green-700 text-white">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Get Your Free Quote
            </h2>
            <p className="text-center text-green-100 mb-8">
              Takes 2 minutes • No obligation • Expert advice
            </p>
            
            <Card className="bg-white">
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
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6"
                  >
                    Get My Free Quote
                  </Button>
                  
                  <p className="text-xs text-center text-gray-500">
                    We typically respond within 2 hours during business hours
                  </p>
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
        <footer className="bg-gray-900 text-white py-12">
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

            <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
              <p>© {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
              <p className="mt-2">Campaign managed by Joinery AI</p>
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-40 flex gap-3">
        <a href={`tel:${tenant.phone}`} className="flex-1">
          <Button className="w-full bg-gray-900 hover:bg-gray-800" onClick={() => track('click_contact_phone', { location: 'mobile_sticky' })}>
            <Phone className="w-5 h-5 mr-2" />
            Call Now
          </Button>
        </a>
        <Button onClick={scrollToForm} className="flex-1 bg-green-600 hover:bg-green-700">
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
