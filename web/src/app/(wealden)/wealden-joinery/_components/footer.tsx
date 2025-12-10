import Link from "next/link";
import Image from "next/image";

// Footer with key contact details for Wealden Joinery.
export function WealdenFooter() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 py-16 md:grid-cols-3 md:px-8">
        <div className="space-y-4">
          <Link href="/wealden-joinery">
            <Image 
              src="/wealden-logo.svg" 
              alt="Wealden Joinery" 
              width={200} 
              height={60}
              className="h-12 w-auto"
            />
          </Link>
          <p className="text-sm leading-relaxed text-slate-600">
            Premium timber windows and doors crafted in our Crowborough headquarters. Serving clients nationwide through our network of showrooms.
          </p>
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">🏭</span>
              <span>Manufacturing HQ: Crowborough, East Sussex</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">📞</span>
              <a className="text-emerald-700 hover:underline" href="tel:+441892123456">01892 123 456</a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">✉️</span>
              <a className="text-emerald-700 hover:underline" href="mailto:hello@wealdenjoinery.co.uk">hello@wealdenjoinery.co.uk</a>
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-900">Explore</h4>
          <nav className="grid grid-cols-2 gap-3 text-sm text-slate-700">
            {["Windows", "Doors", "Alu-Clad", "Projects", "Choices", "Showrooms", "About", "Contact"].map((item) => (
              <Link key={item} href={`/wealden-joinery/${item.toLowerCase().replace(" ", "-")}`} className="transition-colors hover:text-emerald-700">
                {item}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900">Visit Us</h4>
          <p className="text-sm leading-relaxed text-slate-600">
            Visit one of our showrooms nationwide to see our products, discuss your project, and explore timber samples and finishes.
          </p>
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link
              href="/wealden-joinery/contact"
              className="rounded-full bg-emerald-700 px-5 py-2.5 text-white transition hover:scale-[1.02] hover:bg-emerald-800"
            >
              Book a Consultation
            </Link>
            <Link
              href="/wealden-joinery/estimate"
              className="rounded-full border border-slate-300 px-5 py-2.5 text-slate-700 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Get an Estimate
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 bg-slate-50 py-4 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} Wealden Joinery. All rights reserved. Privacy · Terms · Cookies
      </div>
    </footer>
  );
}
