import Image from 'next/image';
import { WealdenFooter, WealdenImage, WealdenNav } from '../wealden-shared';
import imageMap from '../../../../scripts/wealden-image-map.json';

export default function AboutPage({ params }: { params: { slug: string } }) {
  const images: WealdenImage[] = (imageMap.images as WealdenImage[]) || [];
  const workshopImage = images.find((img) => img.localPath.includes('workshop')) || images[0];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <WealdenNav slug={params.slug} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-12">
        <section className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Our story</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">About Wealden Joinery</h1>
          <p className="text-lg text-slate-700 leading-relaxed">
            Founded in the 1990s and based in Rotherfield, our workshop produces high-quality timber windows and doors for homes
            across East Sussex and Kent. We specialise in heritage-sensitive work, guided by City & Guilds trained craftsmen.
          </p>
        </section>

        <section className="grid lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-4 text-slate-700 text-lg leading-relaxed">
            <p>
              We started as a small local joinery serving period homes. Today we blend traditional skills with modern machinery to
              craft sash windows, casements and doors that look right and perform beautifully.
            </p>
            <p>
              Every commission receives careful attention to mouldings, glazing bars and finishing details. We&apos;re trusted by
              homeowners, architects and contractors for reliable lead times and respectful site work.
            </p>
            <p>
              Our team is hands-on throughout: surveying, crafting in the workshop and installing with care so your home is left
              tidy and protected.
            </p>
          </div>
          <div className="relative h-[320px] sm:h-[380px] rounded-2xl overflow-hidden shadow-lg">
            {workshopImage && (
              <Image src={workshopImage.localPath} alt={workshopImage.alt || 'Wealden workshop'} fill className="object-cover" />
            )}
          </div>
        </section>

        <section className="grid md:grid-cols-4 gap-6">
          {[{ title: 'Craftsmanship', description: 'City & Guilds trained joiners focused on fine detailing.' }, { title: 'Reliability', description: 'Clear communication, realistic lead times and tidy installation.' }, { title: 'Respect for homes', description: 'We protect floors, furnishings and neighbours while we work.' }, { title: 'Sustainability', description: 'FSC timber options and designs built for repair and longevity.' }].map((value) => (
            <div key={value.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">{value.title}</h3>
              <p className="text-sm text-slate-700 leading-relaxed">{value.description}</p>
            </div>
          ))}
        </section>

        <section className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900">Our process</h2>
            <p className="text-lg text-slate-700 leading-relaxed">
              From survey to installation, we guide you through designs, prepare drawings where needed, and coordinate fitting
              with minimal disruption.
            </p>
            <p className="text-sm text-slate-600">
              Want to learn more? Head back to our landing page for the step-by-step overview.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-inner text-sm text-slate-700 space-y-2">
            <div className="font-semibold text-slate-900">Areas we serve</div>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {["Rotherfield", "Tunbridge Wells", "Crowborough", "Mayfield", "Wadhurst", "Lewes", "Sevenoaks", "Heathfield", "Uckfield", "Frant"].map((town) => (
                <li key={town} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                  <span>{town}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <WealdenFooter slug={params.slug} />
    </div>
  );
}
