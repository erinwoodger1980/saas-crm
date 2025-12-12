"use client";

import Image from "next/image";
import { ImageUploadButton } from "./image-upload-button";

interface HeroSectionProps {
  heroImg: {
    publicPath: string;
    caption: string;
    width: number;
    height: number;
  } | null;
}

export function HeroSection({ heroImg }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden">
      {heroImg ? (
        <div className="relative h-[75vh] min-h-[600px] w-full">
          <Image
            src={heroImg.publicPath}
            alt={heroImg.caption}
            width={heroImg.width}
            height={heroImg.height}
            className="object-cover"
            priority
          />
          <div className="absolute top-4 right-4 z-20">
            <ImageUploadButton label="Hero Image" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/30 to-transparent" />
          <div className="absolute inset-0 flex items-end">
            <div className="w-full px-6 pb-20 md:px-16 md:pb-32">
              <div className="mx-auto max-w-4xl space-y-6 text-white">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/70">
                  Lignum by Wealden Joinery
                </p>
                <h1 className="text-5xl font-light leading-[1.05] tracking-tight md:text-7xl lg:text-8xl">
                  Timber windows<br />engineered to endure
                </h1>
                <p className="max-w-2xl text-lg font-light leading-relaxed text-white/85 md:text-xl">
                  From Georgian townhouses to contemporary builds. Heritage sash, flush casement, and wood-aluminium systems manufactured to conservation standards.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative h-[75vh] min-h-[600px] w-full bg-slate-100 border-2 border-dashed border-slate-300">
          <div className="flex h-full items-center justify-center">
            <div className="space-y-4 text-center p-6">
              <p className="text-sm font-medium uppercase tracking-wider text-slate-400">
                Hero Image
              </p>
              <ImageUploadButton label="Hero Image" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
