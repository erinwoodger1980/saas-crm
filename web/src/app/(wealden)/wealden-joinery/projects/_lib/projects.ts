export type WealdenProject = {
  slug: string;
  title: string;
  location: string;
  type: string;
  products?: string;
  description?: string;
  bullets?: string[];
  imageSlotId: string;
};

// Keep this list intentionally small for go-live. Add more as content/images are ready.
export const wealdenProjects: WealdenProject[] = [
  {
    slug: "victorian-villa-kent",
    title: "Victorian Villa, Kent",
    location: "Tunbridge Wells, Kent",
    type: "Victorian villa",
    products: "Sash windows & entrance door",
    description: "Complete ground floor replacement with heritage glazing bars and conservation area approval.",
    bullets: [
      "12 sash windows with slim double glazing",
      "Oak entrance door with leaded glass",
      "F&B Railings paint finish",
      "3-day installation",
    ],
    imageSlotId: "projects-victorian-villa-kent-hero",
  },
  {
    slug: "georgian-townhouse-sussex",
    title: "Georgian Townhouse, Sussex",
    location: "Lewes, East Sussex",
    type: "Georgian townhouse",
    products: "Slimline sash replacements",
    description: "Listed building consent for 18 bespoke sash windows with traditional weight-and-pulley balances.",
    bullets: [
      "18 sash windows across three floors",
      "Heritage glazing bar patterns",
      "Lime putty glazing",
      "Listed building consent obtained",
    ],
    imageSlotId: "projects-georgian-townhouse-sussex-hero",
  },
  {
    slug: "holiday-let-window-replacement-kent",
    title: "Holiday Let Window Replacement, Kent",
    location: "Holiday-let development, Kent",
    type: "Holiday let window replacement",
    products: "Accoya® timber windows & doors — RAL 1013",
    description:
      "A tight early-December programme to replace windows across multiple units while keeping changeovers running and downtime to a minimum.",
    bullets: [
      "Replacement windows and a new doorway formation",
      "Area-by-area ironmongery schedules (multiple styles)",
      "Access-control fixed screen replacing French doors",
      "Delivered on time despite poor weather",
    ],
    imageSlotId: "projects-holiday-let-window-replacement-kent-hero",
  },
];

export function getWealdenProjectBySlug(slug: string): WealdenProject | undefined {
  return wealdenProjects.find((p) => p.slug === slug);
}
