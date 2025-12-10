import Link from "next/link";

// Footer with key contact details for Wealden Joinery.
export function WealdenFooter() {
  return (
    <footer className="border-t border-amber-100/70 bg-white/70 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 md:grid-cols-3 md:px-6">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Wealden Joinery</h3>
          <p className="text-sm text-slate-600">
            Crafted timber windows and doors from the heart of East Sussex. Premium materials, meticulous installation, and
            aftercare you can rely on.
          </p>
          <div className="space-y-1 text-sm text-slate-700">
            <div>Workshop: East Sussex (exact address TBD)</div>
            <div>Phone: <a className="text-amber-900" href="tel:+440000000000">+44 (0)0 0000 0000</a> {/* TODO: real number */}</div>
            <div>Email: <a className="text-amber-900" href="mailto:hello@wealdenjoinery.co.uk">hello@wealdenjoinery.co.uk</a></div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-900/80">Explore</h4>
          <nav className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-700">
            {["Windows", "Doors", "Alu-Clad", "Projects", "Choices", "About", "Contact"].map((item) => (
              <Link key={item} href={`/wealden-joinery/${item.toLowerCase().replace(" ", "-")}`} className="hover:text-amber-900">
                {item}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-900/80">Stay in touch</h4>
          <p className="text-sm text-slate-600">
            Book a showroom visit or send us your plans. We’ll guide you on heritage compliance, performance, and finish options.
          </p>
          <div className="flex flex-wrap gap-3 text-sm font-semibold text-white">
            <Link
              href="/wealden-joinery/contact"
              className="rounded-full bg-amber-800 px-4 py-2 transition hover:bg-amber-900"
            >
              Book a Consultation
            </Link>
            <Link
              href="/wealden-joinery/estimate"
              className="rounded-full border border-amber-800 px-4 py-2 text-amber-900 transition hover:bg-amber-50"
            >
              Get an Instant Estimate
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-amber-100/70 bg-amber-50/50 py-4 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} Wealden Joinery. All rights reserved. Privacy · Terms · Cookies
      </div>
    </footer>
  );
}
