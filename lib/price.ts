export function buildSignupUrl(ref?: string) {
  if (!ref) return '/signup';
  const url = new URL('/signup', 'http://localhost');
  url.searchParams.set('ref', ref);
  return url.pathname + url.search;
}

export function describeSeats(count: number = 1) {
  return `${count} seat${count === 1 ? '' : 's'}`;
}

export function formatGBP(value: number) {
  return '£' + value.toFixed(2);
}

export function getBasePrice(term?: 'monthly' | 'annual') {
  if (term === 'annual') return 80;
  return 100; // monthly default
}

export type BillingCadence = 'monthly' | 'annual';

export function getDiscountedPrice(term?: BillingCadence) {
  const base = getBasePrice(term);
  if (term === 'annual') return Math.round(base * 0.9);
  return base;
}
