import { ReactNode } from "react";
import Image from "next/image";
import { TrackingScripts } from "../(wealden)/wealden-joinery/_components/tracking";

export default function TimberWindowsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <TrackingScripts />
      <header className="border-b border-slate-200/60 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 md:px-8">
          <Image
            src="/lignum-windows-logo.jpg"
            alt="Lignum Windows by Wealden Joinery"
            width={320}
            height={96}
            className="h-14 w-auto"
            priority
          />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pt-4 pb-10 md:px-8 md:pt-6 md:pb-14">
        {children}
      </main>
    </div>
  );
}
