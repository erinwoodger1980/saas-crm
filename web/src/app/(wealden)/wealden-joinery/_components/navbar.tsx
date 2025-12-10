import Link from "next/link";
import Image from "next/image";

// Top navigation for the Wealden Joinery marketing site section.
const links = [
  { href: "/wealden-joinery/windows", label: "Windows" },
  { href: "/wealden-joinery/doors", label: "Doors" },
  { href: "/wealden-joinery/alu-clad", label: "Alu-Clad" },
  { href: "/wealden-joinery/projects", label: "Projects" },
  { href: "/wealden-joinery/choices", label: "Choices" },
  { href: "/wealden-joinery/showrooms", label: "Showrooms" },
  { href: "/wealden-joinery/about", label: "About" },
  { href: "/wealden-joinery/contact", label: "Contact" },
];

export function WealdenNavbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/90 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <Link href="/wealden-joinery" className="flex items-center transition-opacity hover:opacity-80">
          <Image 
            src="/wealden-logo.svg" 
            alt="Wealden Joinery" 
            width={240} 
            height={80}
            className="h-14 w-auto"
            priority
          />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-700 lg:flex">
          {links.map((link) => (
            <Link 
              key={link.href} 
              href={link.href} 
              className="relative transition-colors hover:text-emerald-700 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-emerald-700 after:transition-all hover:after:w-full"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/wealden-joinery/estimate"
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:scale-[1.02] hover:bg-emerald-800 hover:shadow-lg"
          >
            Get an Estimate
          </Link>
          <Link
            href="/wealden-joinery/contact"
            className="hidden rounded-full border-2 border-slate-300 px-5 py-2 text-sm font-semibold text-slate-800 transition hover:border-emerald-700 hover:text-emerald-700 md:inline-flex"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </header>
  );
}
