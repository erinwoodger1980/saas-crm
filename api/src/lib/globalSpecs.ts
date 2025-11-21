const MAX_SPEC_LENGTH = 280;

export type NormalizedGlobalSpecs = {
  timber: string;
  glass: string;
  ironmongery: string;
  finish: string;
};

const DEFAULT_SPECS: NormalizedGlobalSpecs = {
  timber: "",
  glass: "",
  ironmongery: "",
  finish: "",
};

const ANSWER_KEYS = {
  timber: "global_timber_spec",
  glass: "global_glass_spec",
  ironmongery: "global_ironmongery_spec",
  finish: "global_finish_spec",
} as const;

function normalizeSpecValue(value: any): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > MAX_SPEC_LENGTH ? trimmed.slice(0, MAX_SPEC_LENGTH) : trimmed;
}

export function extractGlobalSpecsFromAnswers(answers?: Record<string, any>): NormalizedGlobalSpecs {
  if (!answers) return { ...DEFAULT_SPECS };
  return {
    timber: normalizeSpecValue(answers[ANSWER_KEYS.timber]),
    glass: normalizeSpecValue(answers[ANSWER_KEYS.glass]),
    ironmongery: normalizeSpecValue(answers[ANSWER_KEYS.ironmongery]),
    finish: normalizeSpecValue(answers[ANSWER_KEYS.finish]),
  };
}

export function normalizeLeadGlobalSpecs(lead: Partial<Record<keyof typeof ANSWER_KEYS, string>> & {
  globalTimberSpec?: string | null;
  globalGlassSpec?: string | null;
  globalIronmongerySpec?: string | null;
  globalFinishSpec?: string | null;
}): NormalizedGlobalSpecs {
  return {
    timber: normalizeSpecValue(lead.globalTimberSpec ?? ""),
    glass: normalizeSpecValue(lead.globalGlassSpec ?? ""),
    ironmongery: normalizeSpecValue(lead.globalIronmongerySpec ?? ""),
    finish: normalizeSpecValue(lead.globalFinishSpec ?? ""),
  };
}

export function specsToPrismaData(specs: NormalizedGlobalSpecs) {
  return {
    globalTimberSpec: specs.timber,
    globalGlassSpec: specs.glass,
    globalIronmongerySpec: specs.ironmongery,
    globalFinishSpec: specs.finish,
  };
}

export function specsToAnswerPayload(specs: NormalizedGlobalSpecs) {
  return {
    [ANSWER_KEYS.timber]: specs.timber,
    [ANSWER_KEYS.glass]: specs.glass,
    [ANSWER_KEYS.ironmongery]: specs.ironmongery,
    [ANSWER_KEYS.finish]: specs.finish,
  };
}

export function hasAnyGlobalSpec(specs: NormalizedGlobalSpecs): boolean {
  return Boolean(specs.timber || specs.glass || specs.ironmongery || specs.finish);
}
