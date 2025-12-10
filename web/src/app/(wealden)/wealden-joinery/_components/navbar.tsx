import Link from "next/link";

// Top navigation for the Wealden Joinery marketing site section.
const links = [
  { href: "/wealden-joinery/windows", label: "Windows" },
  { href: "/wealden-joinery/doors", label: "Doors" },
  { href: "/wealden-joinery/alu-clad", label: "Alu-Clad" },
  { href: "/wealden-joinery/projects", label: "Projects" },
  { href: "/wealden-joinery/choices", label: "Choices" },
  { href: "/wealden-joinery/about", label: "About" },
  { href: "/wealden-joinery/contact", label: "Contact" },
];

export function WealdenNavbar() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur border-b border-white/20 bg-white/70">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <Link href="/wealden-joinery" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-200 via-amber-100 to-amber-300 border border-amber-200 shadow-inner" />
          <div className="leading-tight">
            <div className="text-sm uppercase tracking-[0.2em] text-amber-900/70">Wealden</div>
            <div className="text-lg font-semibold text-slate-900">Joinery</div>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 lg:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-amber-900">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/wealden-joinery/estimate"
            className="rounded-full bg-amber-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-900"
          >
            Get an Instant Estimate
          </Link>
          <Link
            href="/wealden-joinery/contact"
            className="hidden rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-amber-800 hover:text-amber-900 md:inline-flex"
          >
            Book a Consultation
          </Link>
        </div>
      </div>
    </header>
  );
}
