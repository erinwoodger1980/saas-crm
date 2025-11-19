/**
 * Quote Source Profiles
 * 
 * Global registry of quote sources (suppliers and software systems).
 * Used for auto-detection and layout template matching.
 */

export type QuoteSourceType = "supplier" | "software";

export type QuoteSourceProfile = {
  id: string;                    // e.g. "brio_v1", "joinerysoft_a"
  type: QuoteSourceType;         // "supplier" or "software"
  displayName: string;           // "Brio (standard PDF v1)", "JoinerySoft - style A"
  matchHints: {
    textIncludes?: string[];     // text patterns to look for in PDF content
    filenameIncludes?: string[]; // filename patterns
    emailDomainIncludes?: string[]; // optional email domain hints
  };
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
    matchHints: {
      textIncludes: ["BRIO", "Brio UK", "BRIO DOOR SYSTEMS"],
      emailDomainIncludes: ["brio.co.uk"],
    },
  },
  {
    id: "aluclad_factory_v1",
    type: "supplier",
    displayName: "Aluclad Factory (v1)",
    matchHints: {
      textIncludes: ["ALUCLAD", "Aluclad", "AluClad"],
      emailDomainIncludes: ["aluclad.co.uk"],
    },
  },
  {
    id: "siegenia_v1",
    type: "supplier",
    displayName: "Siegenia (v1)",
    matchHints: {
      textIncludes: ["SIEGENIA", "Siegenia"],
      emailDomainIncludes: ["siegenia.com"],
    },
  },
  {
    id: "generic_supplier",
    type: "supplier",
    displayName: "Generic supplier (fallback)",
    matchHints: {
      textIncludes: ["QUOTE", "QUOTATION", "ESTIMATE", "PROFORMA"],
    },
  },

  // Software/system profiles
  {
    id: "joinerysoft_a",
    type: "software",
    displayName: "JoinerySoft - style A",
    matchHints: {
      textIncludes: ["Joinerysoft", "JoinerySoft", "JOINERYSOFT"],
      filenameIncludes: ["joinerysoft", "jsquote"],
    },
  },
  {
    id: "user_quote_default",
    type: "software",
    displayName: "User quote (default table)",
    matchHints: {
      filenameIncludes: ["quote", "estimate", "proposal"],
    },
  },
  {
    id: "historic_v1",
    type: "software",
    displayName: "Historic quote (legacy system)",
    matchHints: {
      filenameIncludes: ["historic", "legacy", "old"],
    },
  },
];

/**
 * Auto-detect quote source profile from PDF metadata
 * 
 * Uses filename and first page text to score and match profiles.
 * Returns the best-matching profile or null if no good match.
 */
export function autoDetectQuoteSourceProfile(
  filename: string,
  firstPageText: string
): QuoteSourceProfile | null {
  const filenameLower = filename.toLowerCase();
  const textLower = firstPageText.toLowerCase();

  let bestProfile: QuoteSourceProfile | null = null;
  let bestScore = 0;

  for (const profile of quoteSourceProfiles) {
    let score = 0;

    // Score text matches (+2 points each)
    if (profile.matchHints.textIncludes) {
      for (const hint of profile.matchHints.textIncludes) {
        if (textLower.includes(hint.toLowerCase())) {
          score += 2;
        }
      }
    }

    // Score filename matches (+1 point each)
    if (profile.matchHints.filenameIncludes) {
      for (const hint of profile.matchHints.filenameIncludes) {
        if (filenameLower.includes(hint.toLowerCase())) {
          score += 1;
        }
      }
    }

    // Update best match
    if (score > bestScore) {
      bestScore = score;
      bestProfile = profile;
    }
  }

  // Require at least a score of 1 to return a match
  return bestScore >= 1 ? bestProfile : null;
}

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
