// web/src/app/reset-password/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";
import ResetClient from "./reset-client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-6">Loading…</main>}>
      <ResetClient />
    </Suspense>
  );
}