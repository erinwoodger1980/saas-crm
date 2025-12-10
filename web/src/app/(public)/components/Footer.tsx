import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-12 text-slate-600 sm:px-10 lg:px-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2 text-slate-600">
          <p className="text-base font-semibold text-slate-900">JoineryAI</p>
          <p>Faster quotes, smarter workshops.</p>
          <p>© {year} JoineryAI. All rights reserved.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-600">
          <Link
            href="/policy/terms"
            className="transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            Terms
          </Link>
          <Link
            href="/policy/privacy"
            className="transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            Privacy
          </Link>
          <a
            href="mailto:erin@erinwoodger.com"
            className="transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
