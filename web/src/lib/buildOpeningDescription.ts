export type StructuralInfo = {
  productType?: string | null;
  openingConfig?: string | null;
  glazingStyle?: string | null;
  glassType?: string | null;
  colour?: string | null;
  color?: string | null;
  material?: string | null;
  finish?: string | null;
  ironmongery?: string | null;
  description?: string | null;
};

export type GlobalSpecs = {
  timber?: string | null;
  glass?: string | null;
  ironmongery?: string | null;
  finish?: string | null;
};

export const DESCRIPTION_AUTO_MODE = "AUTO_FROM_GLOBALS" as const;
export const DESCRIPTION_MANUAL_MODE = "MANUAL" as const;
export type DescriptionMode = typeof DESCRIPTION_AUTO_MODE | typeof DESCRIPTION_MANUAL_MODE;

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}

function capitalize(sentence: string): string {
  if (!sentence) return "";
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function buildOpeningDescription(structural: StructuralInfo, globalSpecs: GlobalSpecs): string {
  const timber = firstNonEmpty(globalSpecs.timber, structural.material);
  const finish = firstNonEmpty(globalSpecs.finish, structural.finish);
  const glass = firstNonEmpty(globalSpecs.glass, structural.glassType);
  const glazingStyle = firstNonEmpty(structural.glazingStyle);
  const ironmongery = firstNonEmpty(globalSpecs.ironmongery, structural.ironmongery);
  const colour = firstNonEmpty(structural.colour, structural.color);
  const productType = firstNonEmpty(structural.productType, structural.openingConfig);

  const phrases: string[] = [];

  const leading = [timber || null, productType || null].filter(Boolean).join(" ").trim();
  if (leading) {
    phrases.push(leading);
  } else if (productType) {
    phrases.push(productType);
  }

  if (colour) {
    phrases.push(colour);
  }

  if (glass) {
    const glassPhrase = glazingStyle && !glass.toLowerCase().includes(glazingStyle.toLowerCase())
      ? `${glass} with ${glazingStyle}`
      : glass;
    phrases.push(glassPhrase);
  } else if (glazingStyle) {
    phrases.push(glazingStyle);
  }

  if (ironmongery) {
    const lower = ironmongery.toLowerCase();
    phrases.push(lower.includes("ironmongery") ? ironmongery : `${ironmongery} ironmongery`);
  }

  if (finish) {
    phrases.push(finish);
  }

  let description = phrases.filter(Boolean).join(", ");
  if (!description) {
    const fallback = firstNonEmpty(structural.description);
    description = fallback;
  }

  if (!description) return "";
  return description.endsWith(".") ? capitalize(description.trim()) : `${capitalize(description.trim())}.`;
}
