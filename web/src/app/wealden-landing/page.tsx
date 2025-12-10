import { redirect } from "next/navigation";

/**
 * Legacy Wealden landing page redirect.
 * The modern site now lives at /tenant/wealden-joinery/landing.
 */
export default function WealdenLandingPage() {
  redirect("/tenant/wealden-joinery/landing");
}
