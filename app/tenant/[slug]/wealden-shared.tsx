import Link from 'next/link';

export type WealdenImage = {
  originalUrl: string;
  localPath: string;
  alt: string;
  page?: string;
};

export const tenantProfile = {
  name: 'Wealden Joinery',
  phone: '01892 852544',
  email: 'martin@wealdenjoinery.com',
  location: 'Rotherfield, East Sussex',
};

const getNavLinks = (basePath: string) => [
  { label: 'Windows', href: `${basePath}/windows` },
  { label: 'Doors', href: `${basePath}/doors` },
  { label: 'Alu-Clad', href: `${basePath}/alu-clad` },
  { label: 'Projects', href: `${basePath}/projects` },
  { label: 'Choices', href: `${basePath}/choices` },
  { label: 'About', href: `${basePath}/about` },
  { label: 'Contact', href: `${basePath}/contact` },
];

export function WealdenNav({ slug }: { slug: string }) {
  const basePath = `/tenant/${slug}`;

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur lg:sticky lg:top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link href={`${basePath}/landing`} className="text-2xl font-semibold tracking-tight text-slate-900">
          {tenantProfile.name}
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
          {getNavLinks(basePath).map((item) => (
            <Link key={item.label} href={item.href} className="hover:text-green-800 transition-colors">
              {item.label}
            </Link>
          ))}
          <Link
            href={`${basePath}/estimate`}
            className="inline-flex items-center rounded-full bg-green-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-900 transition-colors"
          >
            Get an Instant Estimate
          </Link>
        </div>
        <details className="md:hidden relative group">
          <summary className="list-none cursor-pointer rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <span className="block w-5 h-0.5 bg-slate-900" />
            <span className="block w-5 h-0.5 bg-slate-900" />
            <span className="block w-5 h-0.5 bg-slate-900" />
          </summary>
          <div className="absolute right-0 mt-3 w-64 rounded-lg border border-slate-200 bg-white shadow-lg p-4 flex flex-col gap-3 z-20">
            {getNavLinks(basePath).map((item) => (
              <Link key={item.label} href={item.href} className="text-sm font-medium text-slate-800 hover:text-green-800">
                {item.label}
              </Link>
            ))}
            <Link
              href={`${basePath}/estimate`}
              className="inline-flex items-center justify-center rounded-full bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-900"
            >
              Get an Instant Estimate
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}

export function WealdenFooter({ slug }: { slug: string }) {
  const basePath = `/tenant/${slug}`;

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid md:grid-cols-3 gap-8 text-sm text-slate-700">
        <div className="space-y-2">
          <div className="text-lg font-semibold text-slate-900">{tenantProfile.name}</div>
          <p>{tenantProfile.location}</p>
          <p>
            Phone:{' '}
            <Link href={`tel:${tenantProfile.phone.replace(/\s+/g, '')}`} className="font-semibold text-green-800">
              {tenantProfile.phone}
            </Link>
          </p>
          <p>
            Email:{' '}
            <Link href={`mailto:${tenantProfile.email}`} className="font-semibold text-green-800">
              {tenantProfile.email}
            </Link>
          </p>
        </div>
        <div>
          <div className="text-lg font-semibold text-slate-900">Service areas</div>
          <p className="mt-2 leading-relaxed">
            East Sussex, Kent, Rotherfield, Tunbridge Wells, Crowborough, Uckfield, Heathfield, Mayfield, Wadhurst, Frant.
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-lg font-semibold text-slate-900">Links</div>
          <div className="flex flex-col gap-2">
            <Link href={`${basePath}/contact`} className="hover:text-green-800">
              Contact
            </Link>
            <Link href={`${basePath}/estimate`} className="hover:text-green-800">
              Get an Instant Estimate
            </Link>
            <Link href={`${basePath}/projects`} className="hover:text-green-800">
              Projects
            </Link>
            <Link href="/privacy" className="hover:text-green-800">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-green-800">
              Terms & Conditions
            </Link>
          </div>
          <p className="pt-4 text-xs text-slate-500">© 2025 Wealden Joinery. All rights reserved.</p>
          <p className="text-xs text-slate-500">Campaign powered by Joinery AI</p>
        </div>
      </div>
    </footer>
  );
}
