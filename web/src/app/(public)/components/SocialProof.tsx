const LOGOS = ["Crown Joinery", "Oak & Co.", "Harbour Kitchens", "Metro Fitouts"];

const TESTIMONIALS = [
  {
    name: "Sophie Grant",
    role: "Director, Grant & Sons Joinery",
    quote:
      "We now send polished quotes within an hour of surveys. Workshop capacity is synced automatically so we close more jobs without overtime.",
  },
  {
    name: "Lewis Patel",
    role: "Operations Lead, Timberline",
    quote:
      "Follow-ups fire at the right moment and our showroom team know exactly what the workshop is cutting each day.",
  },
  {
    name: "Amelia Roberts",
    role: "Commercial Manager, Crafted Installers",
    quote:
      "The 60% lifetime offer let us roll out JoineryAI to three locations. Support has been instant and thoughtful.",
  },
];

export default function SocialProof() {
  return (
    <section className="px-6 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-500">
          Built by joiners, for joiners
        </p>
        <div className="grid w-full grid-cols-2 gap-6 text-sm text-slate-500 sm:grid-cols-4">
          {LOGOS.map((logo) => (
            <div
              key={logo}
              className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm font-semibold uppercase tracking-wide text-slate-500"
              aria-label={`${logo} logo placeholder`}
            >
              {logo}
            </div>
          ))}
        </div>
        <div className="grid w-full gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <figure
              key={testimonial.name}
              className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-slate-200" aria-hidden />
                <figcaption>
                  <p className="text-base font-semibold text-slate-900">{testimonial.name}</p>
                  <p className="text-sm text-slate-500">{testimonial.role}</p>
                </figcaption>
              </div>
              <blockquote className="mt-4 text-base leading-relaxed text-slate-600">
                “{testimonial.quote}”
              </blockquote>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
