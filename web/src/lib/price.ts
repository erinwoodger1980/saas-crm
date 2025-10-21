const GBP_FORMATTER = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const BASE_MONTHLY_PRICE = 625;
export const BASE_ANNUAL_PRICE = 468.75;
export const DISCOUNT_RATE = 0.6;

export type BillingCadence = "monthly" | "annual";

export function getDiscountMultiplier(): number {
  return 1 - DISCOUNT_RATE;
}

export function formatGBP(value: number): string {
  return GBP_FORMATTER.format(value);
}

export function getBasePrice(cadence: BillingCadence): number {
  return cadence === "monthly" ? BASE_MONTHLY_PRICE : BASE_ANNUAL_PRICE;
}

export function getDiscountedPrice(cadence: BillingCadence): number {
  return getBasePrice(cadence) * getDiscountMultiplier();
}

export function buildSignupUrl(
  cadence: BillingCadence,
  referral?: string,
): string {
  const base = `/signup?plan=${cadence}&promo=EARLY60`;
  if (!referral) return base;
  const url = new URL(base, "https://joineryai.app");
  url.searchParams.set("ref", referral);
  return `${url.pathname}${url.search}`;
}

export function describeSeats(): string {
  return "Includes 5 office users, 10 workshop users, 2 display users";
}
