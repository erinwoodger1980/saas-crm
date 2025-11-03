"use client";

import { clearJwt } from "@/lib/api";
import { Button } from '@/components/ui/button';

export default function LogoutButton() {
  return (
    <Button
      onClick={() => {
        clearJwt();
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
      }}
      variant="outline"
      size="sm"
      aria-label="Log out"
      title="Log out"
    >
      Logout
    </Button>
  );
}
