import { getTenantBySlug } from '@/lib/tenant/getTenantBySlug';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';

// Helper: TitleCase
function titleCase(str: string) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// Server action to create tenant if missing
export async function createTenantIfMissing(slug: string) {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;
  if (role !== 'admin' && role !== 'owner') throw new Error('Not authorized');
  const prisma = new PrismaClient();
  let tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug,
        name: titleCase(slug),
        logoUrl: '',
        primary: '#0E7490',
        secondary: '#0EA5E9',
      },
    });
  }
  return tenant;
}

export default async function LandingPage({ params }: { params: { slug: string } }) {
  const tenant = await getTenantBySlug(params.slug);
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;

  if (!tenant) {
    return (
      <div className="max-w-xl mx-auto mt-24 p-8 bg-white border rounded shadow">
        <h1 className="text-2xl font-bold mb-2">Tenant Not Found</h1>
        <p className="mb-4">The landing page for <span className="font-mono">{params.slug}</span> could not be loaded.</p>
        {role === 'admin' || role === 'owner' ? (
          <form action={async () => {
            'use server';
            await createTenantIfMissing(params.slug);
            redirect(`/tenant/${params.slug}/landing`);
          }}>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Create tenant '{params.slug}' and retry</button>
          </form>
        ) : null}
      </div>
    );
  }

  // SEO metadata
  const meta: Metadata = {
    title: `${tenant.name} | Joinery AI`,
    description: `Get a quote for your joinery project with ${tenant.name}.`,
    openGraph: {
      title: `${tenant.name} | Joinery AI`,
      description: `Get a quote for your joinery project with ${tenant.name}.`,
      images: [tenant.logoUrl || '/logo.png'],
    },
  };

  // Branded hero + form
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-12">
        <div className="flex flex-col items-center mb-8">
          {tenant.logoUrl && <img src={tenant.logoUrl} alt={tenant.name} className="h-16 mb-2" />}
          <h1 className="text-3xl font-bold" style={{ color: tenant.primary }}>{tenant.name}</h1>
          <p className="text-gray-600 mt-2">Expert joinery, tailored for you.</p>
        </div>
        {/* Lead form */}
        <form action="/api/leads" method="POST" className="space-y-4 bg-white p-6 rounded shadow">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <input type="hidden" name="source" value="landing" />
          {/* Hidden tracking params */}
          <input type="hidden" name="gclid" />
          <input type="hidden" name="gbraid" />
          <input type="hidden" name="wbraid" />
          <input type="hidden" name="fbclid" />
          <input type="hidden" name="utm_source" />
          <input type="hidden" name="utm_medium" />
          <input type="hidden" name="utm_campaign" />
          <input type="hidden" name="utm_term" />
          <input type="hidden" name="utm_content" />
          <div className="grid grid-cols-2 gap-4">
            <input name="name" required placeholder="Name" className="border rounded px-3 py-2" />
            <input name="email" required type="email" placeholder="Email" className="border rounded px-3 py-2" />
            <input name="phone" required placeholder="Phone" className="border rounded px-3 py-2" />
            <input name="postcode" required placeholder="Postcode" className="border rounded px-3 py-2" />
          </div>
          <select name="projectType" required className="border rounded px-3 py-2 w-full">
            <option value="">Project Type</option>
            <option value="windows">Windows</option>
            <option value="doors">Doors</option>
            <option value="stairs">Stairs</option>
            <option value="furniture">Furniture</option>
            <option value="other">Other</option>
          </select>
          <select name="budget" required className="border rounded px-3 py-2 w-full">
            <option value="">Budget</option>
            <option value="<1000">Under £1,000</option>
            <option value="1000-5000">£1,000–5,000</option>
            <option value=">5000">Over £5,000</option>
          </select>
          <textarea name="message" required placeholder="Project details" className="border rounded px-3 py-2 w-full" rows={3} />
          <button type="submit" className="w-full py-3 bg-green-600 text-white rounded font-bold">Get My Quote</button>
        </form>
        <div className="mt-8 text-center text-gray-500">
          <p>Gallery and testimonials coming soon.</p>
        </div>
      </div>
    </div>
  );
}
