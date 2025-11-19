/**
 * Quote Source Profiles (Shared Types)
 * 
 * Shared between frontend and backend for quote source classification
 */

export type QuoteSourceType = "supplier" | "software";

export type QuoteSourceProfile = {
  id: string;
  type: QuoteSourceType;
  displayName: string;
};

/**
 * Global registry of quote source profiles
 * This is app-wide (not tenant-specific)
 */
export const quoteSourceProfiles: QuoteSourceProfile[] = [
  // Supplier profiles
  {
    id: "brio_v1",
    type: "supplier",
    displayName: "Brio (standard PDF v1)",
  },
  {
    id: "aluclad_factory_v1",
    type: "supplier",
    displayName: "Aluclad Factory (v1)",
  },
  {
    id: "siegenia_v1",
    type: "supplier",
    displayName: "Siegenia (v1)",
  },
  {
    id: "generic_supplier",
    type: "supplier",
    displayName: "Generic supplier (fallback)",
  },

  // Software/system profiles
  {
    id: "joinerysoft_a",
    type: "software",
    displayName: "JoinerySoft - style A",
  },
  {
    id: "user_quote_default",
    type: "software",
    displayName: "User quote (default table)",
  },
  {
    id: "historic_v1",
    type: "software",
    displayName: "Historic quote (legacy system)",
  },
];

/**
 * Get profile by ID
 */
export function getQuoteSourceProfile(profileId: string): QuoteSourceProfile | undefined {
  return quoteSourceProfiles.find((p) => p.id === profileId);
}

/**
 * Get all profiles of a specific type
 */
export function getQuoteSourceProfilesByType(type: QuoteSourceType): QuoteSourceProfile[] {
  return quoteSourceProfiles.filter((p) => p.type === type);
}

/**
 * Get default profile for a given type
 */
export function getDefaultProfileForType(type: QuoteSourceType): QuoteSourceProfile {
  if (type === "supplier") {
    return quoteSourceProfiles.find((p) => p.id === "generic_supplier")!;
  } else {
    return quoteSourceProfiles.find((p) => p.id === "user_quote_default")!;
  }
}
