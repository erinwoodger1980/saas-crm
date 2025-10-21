const testimonials = [
  {
    quote:
      "We close jobs faster because JoineryAI keeps the team on the same page — from quote to install.",
    name: "Sam Patel",
    role: "Director, Oakline Joinery",
  },
  {
    quote:
      "It feels like we hired an extra project manager. Follow-ups go out automatically and nothing slips.",
    name: "Laura McKay",
    role: "Showroom Lead, Firth & Co",
  },
  {
    quote:
      "Our workshop screens keep installers focused. The time tracking alone paid for the system in two months.",
    name: "Gavin Reid",
    role: "Operations, North Shore Installers",
  },
];

export default function SocialProof() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto w-full max-w-6xl space-y-12 px-6 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Built by joiners, for joiners
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Trusted by workshops across the UK
          </h2>
          <p className="text-lg text-slate-600">
            From bespoke kitchens to commercial fit-outs, JoineryAI helps teams deliver on time and on brand.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 text-slate-400">
          {["Riverview Joinery", "Elm & Co", "Loughborough Studios", "Marlow Installers"].map((logo) => (
            <span
              key={logo}
              className="flex h-16 w-40 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-sm font-semibold"
            >
              {logo}
            </span>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <figure
              key={testimonial.name}
              className="flex h-full flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-6 text-left shadow-sm"
            >
              <blockquote className="text-sm text-slate-700">“{testimonial.quote}”</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span className="h-10 w-10 rounded-full bg-slate-200" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{testimonial.name}</p>
                  <p className="text-xs text-slate-500">{testimonial.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
