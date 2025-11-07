import { redirect } from 'next/navigation';

/**
 * Alias route: /wealden-landing-new -> /tenant/wealden/landing
 * 
 * Redirects to the multi-tenant landing page to avoid code duplication.
 * The original /wealden-landing route is preserved for backwards compatibility.
 */
export default function WealdenLandingAlias() {
  redirect('/tenant/wealden/landing');
}
