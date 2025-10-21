import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-slate-950 py-12 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <div className="space-y-2">
          <p className="text-lg font-semibold">JoineryAI</p>
          <p className="text-sm text-white/60">© {new Date().getFullYear()} JoineryAI. All rights reserved.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-white/70">
          <Link href="/policy/terms" className="hover:text-white focus-visible:underline">
            Terms
          </Link>
          <Link href="/policy/privacy" className="hover:text-white focus-visible:underline">
            Privacy
          </Link>
          <a href="mailto:hello@joineryai.app" className="hover:text-white focus-visible:underline">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
