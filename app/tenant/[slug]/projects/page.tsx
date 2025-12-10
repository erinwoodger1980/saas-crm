import Image from 'next/image';
import Link from 'next/link';
import imageMap from '../../../../scripts/wealden-image-map.json';
import { WealdenFooter, WealdenImage, WealdenNav } from '../wealden-shared';

const projects = [
  {
    title: 'Tunbridge Wells – Victorian Villa',
    summary: 'Slimline sash replacements and a bold new entrance door.',
    details: ['Property: Victorian villa', 'Challenge: Conservation area with period proportions', 'Solution: Slim glazing bars, heritage horns, upgraded draught sealing'],
    keyword: 'sash',
  },
  {
    title: 'Lewes – Georgian Townhouse',
    summary: 'Make-to-match sash windows with discrete acoustic glazing.',
    details: ['Property: Georgian townhouse', 'Challenge: Minimise visual change while improving comfort', 'Solution: Custom mouldings, acoustic laminated units, painted finish'],
    keyword: 'hero',
  },
  {
    title: 'Sevenoaks – Country Home',
    summary: 'Oak casement windows and French doors to frame garden views.',
    details: ['Property: Country home', 'Challenge: Large openings exposed to weather', 'Solution: Accoya® frames, weather bars, multi-point locking'],
    keyword: 'casement',
  },
  {
    title: 'Crowborough – Cottage Renovation',
    summary: 'New front door and flush casements to refresh a period cottage.',
    details: ['Property: Period cottage', 'Challenge: Keep character while improving security', 'Solution: Engineered front door, flush casements, painted in heritage tones'],
    keyword: 'door',
  },
];

export default function ProjectsPage({ params }: { params: { slug: string } }) {
  const images: WealdenImage[] = (imageMap.images as WealdenImage[]) || [];

  const findImage = (keyword: string) => images.find((img) => img.localPath.includes(keyword)) || images[0];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <WealdenNav slug={params.slug} />

      <main>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Project gallery</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">Recent Projects Across the South East</h1>
          <p className="text-lg text-slate-700 leading-relaxed">
            A snapshot of the bespoke window and door installations we&apos;ve completed for homeowners across East Sussex and Kent.
            Each project is tailored to the property with careful advice on glazing, detailing and installation.
          </p>
        </section>

        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const image = findImage(project.keyword);
              return (
                <article
                  key={project.title}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:-translate-y-1 hover:shadow-lg transition"
                >
                  <div className="relative h-48">
                    {image && (
                      <Image src={image.localPath} alt={image.alt || project.title} fill className="object-cover" />
                    )}
                  </div>
                  <div className="p-5 space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900">{project.title}</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{project.summary}</p>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {project.details.map((detail) => (
                        <li key={detail} className="flex items-start gap-2">
                          <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-6">
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900">Interested in seeing more?</h2>
            <p className="text-lg text-slate-700 leading-relaxed">
              We can share further photography, drawings and specification notes relevant to your type of property. Tell us about
              your home and we&apos;ll curate examples that match.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href={`/tenant/${params.slug}/contact`}
              className="inline-flex items-center justify-center rounded-full bg-green-800 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-green-900"
            >
              Start your project
            </Link>
            <Link
              href="https://www.wealdenjoinery.com/gallery/"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-base font-semibold text-slate-800 hover:border-green-700 hover:text-green-800"
            >
              View more images
            </Link>
          </div>
        </section>
      </main>

      <WealdenFooter slug={params.slug} />
    </div>
  );
}
