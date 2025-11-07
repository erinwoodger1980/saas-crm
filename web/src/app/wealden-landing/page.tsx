"use client";


import { useState } from "react";
import Script from "next/script";


const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || "";
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const HOTJAR_ID = process.env.NEXT_PUBLIC_HOTJAR_ID || "";


export default function WealdenLandingPage() {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setOk(null);
    setErr(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      source: "wealden-landing",
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      postcode: String(form.get("postcode") || ""),
      projectType: String(form.get("projectType") || ""),
      propertyType: String(form.get("propertyType") || ""),
      message: String(form.get("message") || ""),
      recaptchaToken: "",
    };

    try {
      const res = await fetch(`${API_BASE}/leads/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
      }

      if (typeof window !== "undefined") {
        // @ts-expect-error
        window.dataLayer = window.dataLayer || [];
        // @ts-expect-error
        window.dataLayer.push({ event: "generate_lead", channel: "google_ads" });
      }
      // @ts-expect-error
      typeof fbq === "function" && fbq("track", "Lead", { source: "wealden-landing" });

      setOk(true);
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      setOk(false);
      setErr(error?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }


  return (
    <main className="premium-landing">
      {/* Google Fonts for premium look */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

      {/* Analytics/trackers */}
      {GA4_ID ? (
        <>
          <Script id="ga4" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA4_ID}');
          `}</Script>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
        </>
      ) : null}
      {META_PIXEL_ID ? (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s){
              if(f.fbq) return; n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq) f._fbq=n; n.push=n; n.loaded=!0; n.version='2.0';
              n.queue=[]; t=b.createElement(e); t.async=!0;
              t.src=v; s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)
            }(window, document, 'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}</Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      ) : null}
      {HOTJAR_ID ? (
        <Script id="hotjar" strategy="afterInteractive">{`
          (function(h,o,t,j,a,r){
            h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
            h._hjSettings={hjid:${Number(HOTJAR_ID)},hjsv:6};
            a=o.getElementsByTagName('head')[0];
            r=o.createElement('script');r.async=1;
            r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
            a.appendChild(r);
          })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
        `}</Script>
      ) : null}

      {/* Premium global styles */}
      <style jsx global>{`
        :root {
          --premium-bg: #f8f6f2;
          --premium-ink: #18332f;
          --premium-muted: #6b6b6b;
          --premium-gold: #c9a14a;
          --premium-wood: #a67c52;
          --premium-white: #fff;
          --premium-green: #2d4739;
          --premium-shadow: 0 4px 32px 0 rgba(24,51,47,0.08);
        }
        .premium-landing {
          font-family: 'Inter', system-ui, sans-serif;
          background: var(--premium-bg);
          color: var(--premium-ink);
        }
        .premium-hero {
          background: linear-gradient(120deg,rgba(24,51,47,0.92) 60%,rgba(166,124,82,0.12)), url('/images/wealden/p1.jpg') center/cover no-repeat;
          min-height: 520px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--premium-shadow);
          position: relative;
        }
        .premium-hero-content {
          max-width: 700px;
          padding: 56px 32px 48px;
          background: rgba(255,255,255,0.92);
          border-radius: 24px;
          box-shadow: 0 8px 48px 0 rgba(24,51,47,0.10);
          text-align: center;
        }
        .premium-hero h1 {
          font-family: 'Playfair Display', serif;
          font-size: 2.8rem;
          color: var(--premium-ink);
          margin-bottom: 12px;
          font-weight: 700;
          letter-spacing: -1px;
        }
        .premium-hero .gold {
          color: var(--premium-gold);
        }
        .premium-hero p {
          font-size: 1.25rem;
          color: var(--premium-muted);
          margin-bottom: 28px;
        }
        .premium-cta {
          background: var(--premium-gold);
          color: var(--premium-ink);
          border: none;
          border-radius: 12px;
          font-size: 1.15rem;
          font-weight: 600;
          padding: 16px 36px;
          box-shadow: 0 2px 12px 0 rgba(201,161,74,0.10);
          transition: background 0.2s, color 0.2s, box-shadow 0.2s;
          cursor: pointer;
        }
        .premium-cta:hover {
          background: var(--premium-ink);
          color: var(--premium-gold);
          box-shadow: 0 4px 24px 0 rgba(24,51,47,0.18);
        }
        .premium-trust {
          display: flex;
          gap: 18px;
          justify-content: center;
          margin-top: 32px;
          flex-wrap: wrap;
        }
        .premium-trust span {
          background: var(--premium-white);
          border: 1.5px solid var(--premium-gold);
          border-radius: 10px;
          padding: 8px 18px;
          font-size: 1rem;
          color: var(--premium-green);
          font-weight: 600;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 8px 0 rgba(201,161,74,0.06);
        }
        .premium-section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 56px 16px 32px;
        }
        .premium-section h2 {
          font-family: 'Playfair Display', serif;
          font-size: 2.1rem;
          color: var(--premium-ink);
          margin-bottom: 18px;
          font-weight: 700;
        }
        .premium-section p {
          color: var(--premium-muted);
          font-size: 1.1rem;
        }
        .premium-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 18px;
          margin-top: 18px;
        }
        .premium-gallery img {
          width: 100%;
          border-radius: 16px;
          box-shadow: 0 2px 16px 0 rgba(24,51,47,0.10);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .premium-gallery img:hover {
          transform: scale(1.035);
          box-shadow: 0 6px 32px 0 rgba(24,51,47,0.18);
        }
        .premium-testimonials {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
          margin-top: 18px;
        }
        .premium-testimonial {
          background: var(--premium-white);
          border-left: 5px solid var(--premium-gold);
          border-radius: 16px;
          box-shadow: 0 2px 16px 0 rgba(24,51,47,0.08);
          padding: 28px 24px 20px 32px;
          font-style: italic;
          font-size: 1.15rem;
          color: var(--premium-ink);
          position: relative;
        }
        .premium-testimonial .author {
          font-style: normal;
          color: var(--premium-muted);
          font-size: 1rem;
          margin-top: 12px;
          font-weight: 600;
        }
        .premium-form-card {
          background: var(--premium-white);
          border: 2px solid var(--premium-gold);
          border-radius: 18px;
          box-shadow: 0 2px 24px 0 rgba(201,161,74,0.10);
          padding: 36px 28px 28px;
          max-width: 540px;
          margin: 0 auto;
        }
        .premium-form-card label {
          font-family: 'Inter', sans-serif;
          font-size: 1.08rem;
          color: var(--premium-ink);
          font-weight: 600;
        }
        .premium-form-card input,
        .premium-form-card select,
        .premium-form-card textarea {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1.5px solid var(--premium-wood);
          background: #fcfaf7;
          margin-top: 6px;
          margin-bottom: 18px;
          font-size: 1rem;
          transition: border 0.2s, box-shadow 0.2s;
        }
        .premium-form-card input:focus,
        .premium-form-card select:focus,
        .premium-form-card textarea:focus {
          border: 1.5px solid var(--premium-gold);
          box-shadow: 0 0 0 2px var(--premium-gold, #c9a14a33);
          outline: none;
        }
        .premium-form-card .premium-cta {
          width: 100%;
          margin-top: 8px;
        }
        .premium-form-card .small {
          color: var(--premium-muted);
          font-size: 0.98rem;
        }
        .premium-success {
          background: #f6fbe9;
          border: 1.5px solid #bbf7d0;
          color: #2d4739;
          padding: 14px;
          border-radius: 10px;
          margin-bottom: 18px;
        }
        .premium-error {
          background: #fff1f2;
          border: 1.5px solid #fecdd3;
          color: #9f1239;
          padding: 14px;
          border-radius: 10px;
          margin-bottom: 18px;
        }
        .premium-footer {
          margin: 48px 0 24px;
          color: var(--premium-muted);
          font-size: 1.08rem;
          text-align: center;
        }
        @media (max-width: 700px) {
          .premium-hero-content { padding: 32px 8px 32px; }
          .premium-section { padding: 36px 4px 18px; }
          .premium-form-card { padding: 18px 4px 18px; }
        }
      `}</style>

      {/* HERO SECTION */}
      <section className="premium-hero">
        <div className="premium-hero-content">
          <h1>
            <span className="gold">Beautifully Crafted</span> Timber Windows & Doors
            <br />
            <span style={{ fontSize: "1.2rem", fontWeight: 400, color: "#6b6b6b" }}>
              Made in Sussex
            </span>
          </h1>
          <p>Heritage quality. Modern performance. PAS 24 certified for security and peace of mind.</p>
          <button className="premium-cta" onClick={() => document.getElementById('quote')?.scrollIntoView({behavior:'smooth'})}>
            Get Your Free Quotation
          </button>
          <div className="premium-trust">
            <span>PAS 24</span>
            <span>Secured by Design</span>
            <span>FENSA</span>
            <span>Made in Britain</span>
            <span>★★★★★ Reviews</span>
          </div>
        </div>
      </section>

      <section className="premium-section" id="why">
        <h2>Why Choose Wealden Joinery?</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap: '24px',marginTop:12}}>
          <div className="card" style={{background:'var(--premium-white)',borderLeft:'5px solid var(--premium-gold)',borderRadius:16,boxShadow:'0 2px 16px 0 rgba(24,51,47,0.08)',padding:'28px 24px 20px 32px'}}>
            <h3 style={{fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'1.2rem',marginBottom:8}}>Authentic Craftsmanship</h3>
            <p>Every window is hand-finished by our Sussex joiners for a perfect fit and finish.</p>
          </div>
          <div className="card" style={{background:'var(--premium-white)',borderLeft:'5px solid var(--premium-gold)',borderRadius:16,boxShadow:'0 2px 16px 0 rgba(24,51,47,0.08)',padding:'28px 24px 20px 32px'}}>
            <h3 style={{fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'1.2rem',marginBottom:8}}>Built to Last</h3>
            <p>Engineered timber, double glazing, advanced weather seals and factory spray finishing.</p>
          </div>
          <div className="card" style={{background:'var(--premium-white)',borderLeft:'5px solid var(--premium-gold)',borderRadius:16,boxShadow:'0 2px 16px 0 rgba(24,51,47,0.08)',padding:'28px 24px 20px 32px'}}>
            <h3 style={{fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'1.2rem',marginBottom:8}}>Made to Measure</h3>
            <p>Ideal for listed buildings and period homes — sympathetic designs with modern performance.</p>
          </div>
        </div>
      </section>

      <section className="premium-section" id="products">
        <h2>Our Timber Range</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:'24px',marginTop:12}}>
          <div className="card" style={{background:'var(--premium-white)',border:'2px solid var(--premium-gold)',borderRadius:16,boxShadow:'0 2px 16px 0 rgba(24,51,47,0.08)',padding:'24px 20px 18px'}}>
            <h3 style={{fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'1.1rem',marginBottom:8}}>Sash Windows</h3>
            <p>Traditional box sash with cord & weight or spiral balance options.</p>
            <a href="#quote" className="premium-cta" style={{marginTop:12,display:'inline-block'}}>Get Sash Window Quote</a>
          </div>
          <div className="card" style={{background:'var(--premium-white)',border:'2px solid var(--premium-gold)',borderRadius:16,boxShadow:'0 2px 16px 0 rgba(24,51,47,0.08)',padding:'24px 20px 18px'}}>
            <h3 style={{fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'1.1rem',marginBottom:8}}>Casement Windows</h3>
            <p>Slim profiles, draught-proof seals and bespoke glazing bars.</p>
            <a href="#quote" className="premium-cta" style={{marginTop:12,display:'inline-block'}}>Get Casement Quote</a>
          </div>
          <div className="card" style={{background:'var(--premium-white)',border:'2px solid var(--premium-gold)',borderRadius:16,boxShadow:'0 2px 16px 0 rgba(24,51,47,0.08)',padding:'24px 20px 18px'}}>
            <h3 style={{fontFamily:'Playfair Display,serif',fontWeight:700,fontSize:'1.1rem',marginBottom:8}}>Front Doors</h3>
            <p>Fully custom timber entrance doors, PAS 24 compliant.</p>
            <a href="#quote" className="premium-cta" style={{marginTop:12,display:'inline-block'}}>Design My Door</a>
          </div>
        </div>
      </section>

      <section className="wrap" id="process">
        <h2>From Workshop to Your Home — A Seamless Process</h2>
        <div className="grid3">
          <div className="card"><strong>1) Design Consultation</strong><p>Discuss styles, glazing and hardware.</p></div>
          <div className="card"><strong>2) Detailed Quotation</strong><p>Transparent pricing, no surprises.</p></div>
          <div className="card"><strong>3) Manufacture</strong><p>Built in Sussex by our experienced team.</p></div>
        </div>
        <div className="grid3" style={{ marginTop: 12 }}>
          <div className="card"><strong>4) Spray Finish</strong><p>Durable coatings and colour-matched finishes.</p></div>
          <div className="card"><strong>5) Install or Deliver</strong><p>Full installation or supply-only nationwide.</p></div>
          <div className="card"><strong>Guarantees</strong><p>Up to 10-year guarantees on coatings and hardware.</p></div>
        </div>
      </section>

      <section className="premium-section" id="projects">
        <h2>Recent Projects</h2>
        <div className="premium-gallery">
          <img alt="Project 1" src="/images/wealden/p1.jpg" />
          <img alt="Project 2" src="/images/wealden/p2.jpg" />
          <img alt="Project 3" src="/images/wealden/p3.jpg" />
          <img alt="Project 4" src="/images/wealden/p4.jpg" />
          <img alt="Project 5" src="/images/wealden/p5.jpg" />
          <img alt="Project 6" src="/images/wealden/p6.jpg" />
        </div>
        <p className="small" style={{ marginTop: 8, textAlign:'center', color:'var(--premium-muted)' }}>Hove | Tunbridge Wells | Lewes | Conservation Areas</p>
      </section>

      <section className="premium-section" id="testimonials">
        <h2>What Our Clients Say</h2>
        <div className="premium-testimonials">
          <div className="premium-testimonial">
            “The new sash windows have transformed our Georgian home — the detail is superb.”
            <div className="author">— Sarah H., Tunbridge Wells</div>
          </div>
          <div className="premium-testimonial">
            “Professional team, beautiful craftsmanship. Worth every penny.”
            <div className="author">— James R., Hove</div>
          </div>
          <div className="premium-testimonial">
            “Quote was clear, install tidy, and the draughts are gone.”
            <div className="author">— Emma P., Lewes</div>
          </div>
        </div>
      </section>

      <section className="premium-section" id="quote">
        <h2>Request a Free Quotation</h2>
        <p>Complete the short form below — our design team will get back to you within 24 hours.</p>

        {ok && <div className="premium-success">Thank you — your enquiry has been received. We’ll be in touch shortly.</div>}
        {ok === false && <div className="premium-error">Sorry, we couldn’t submit your enquiry. {err}</div>}

        <form className="premium-form-card" onSubmit={onSubmit}>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" required placeholder="Your name" />
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required placeholder="you@example.com" />
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" required placeholder="07..." />
          <label htmlFor="postcode">Postcode</label>
          <input id="postcode" name="postcode" required placeholder="TN1 1AA" />
          <label htmlFor="projectType">Project type</label>
          <select id="projectType" name="projectType" defaultValue="Windows">
            <option>Windows</option><option>Doors</option><option>Windows & Doors</option>
          </select>
          <label htmlFor="propertyType">Property type</label>
          <select id="propertyType" name="propertyType" defaultValue="Period">
            <option>Period</option><option>Listed</option><option>Modern</option><option>Other</option>
          </select>
          <label htmlFor="message">Message (optional)</label>
          <textarea id="message" name="message" rows={4} placeholder="Tell us about your project..." />
          <button className="premium-cta" type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Get My Free Quote"}
          </button>
          <span className="small">We’ll only contact you about your enquiry. No spam, ever.</span>
        </form>
      </section>

      <section className="premium-section">
        <h2>Accreditations & Guarantees</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:'24px',marginTop:12}}>
          <div className="card" style={{background:'var(--premium-white)',border:'2px solid var(--premium-gold)',borderRadius:16,boxShadow:'0 2px 16px 0 rgba(24,51,47,0.08)',padding:'24px 20px 18px'}}>
            <strong>PAS 24</strong><p>Security-tested to national standards.</p>
          </div>
          <div className="card" style={{background:'var(--premium-white)',border:'2px solid var(--premium-gold)',borderRadius:16,boxShadow:'0 2px 16px 0 rgba(24,51,47,0.08)',padding:'24px 20px 18px'}}>
            <strong>Factory-Finished Timber</strong><p>Durable coatings with up to 10-year guarantees.</p>
          </div>
          <div className="card" style={{background:'var(--premium-white)',border:'2px solid var(--premium-gold)',borderRadius:16,boxShadow:'0 2px 16px 0 rgba(24,51,47,0.08)',padding:'24px 20px 18px'}}>
            <strong>Made in Sussex</strong><p>Local craftsmanship, nationwide delivery.</p>
          </div>
        </div>
      </section>

      <footer className="premium-footer">
        <strong>Wealden Joinery Ltd</strong><br />
        Unit [address], East Sussex · 01892 [number] · info@wealdenjoinery.com
        <div className="small" style={{ marginTop: 8 }}>
          Mon–Fri 8:00–17:00 · Sat by appointment
        </div>
        <div style={{ marginTop: 12 }}>
          <a href="https://wealdenjoinery.com" style={{ color: "var(--premium-gold)", textDecoration: "underline" }}>
            Visit our main website for more information →
          </a>
        </div>
      </footer>
    </main>
  );
}
