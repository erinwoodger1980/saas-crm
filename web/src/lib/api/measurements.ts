import { apiFetch } from "@/lib/api";

export type PhotoMeasurementAttributes = {
  product_type?: string | null;
  opening_config?: string | null;
  material?: string | null;
  colour?: string | null;
  glazing_style?: string | null;
  ironmongery?: string | null;
  style_tags?: string[] | null;
  description?: string | null;
  notes?: string | null;
};

export type PhotoMeasurementResponse = {
  width_mm: number | null;
  height_mm: number | null;
  confidence: number | null;
  attributes?: PhotoMeasurementAttributes;
};

export type InspirationAnalysisAttributes = {
  mood?: string | null;
  palette?: string[] | null;
  styleTags?: string[] | null;
  heroFeatures?: string[] | null;
  materialCues?: string[] | null;
  glazingCues?: string[] | null;
  hardwareCues?: string[] | null;
  recommendedSpecs?: {
    timber?: string | null;
    finish?: string | null;
    glazing?: string | null;
    ironmongery?: string | null;
  } | null;
  description?: string | null;
  notes?: string | null;
};

export type InspirationAnalysisResponse = {
  confidence: number | null;
  attributes: InspirationAnalysisAttributes;
};

export async function estimateDimensionsFromPhotoClient(input: {
  file: File;
  openingType?: string | null;
  floorLevel?: string | null;
  notes?: string | null;
}): Promise<PhotoMeasurementResponse> {
  if (!input?.file) {
    throw new Error("Photo file required");
  }

  const form = new FormData();
  form.append("photo", input.file);
  const contextPayload = {
    openingType: input.openingType ?? null,
    floorLevel: input.floorLevel ?? null,
    notes: input.notes ?? null,
  };
  form.append("context", JSON.stringify(contextPayload));

  return apiFetch<PhotoMeasurementResponse>("/measurements/from-photo", {
    method: "POST",
    body: form as any,
  } as any);
}

export async function analyzeInspirationFromPhotoClient(input: {
  file: File;
  desiredProduct?: string | null;
  projectNotes?: string | null;
  keywords?: string[] | null;
}): Promise<InspirationAnalysisResponse> {
  if (!input?.file) {
    throw new Error("Photo file required");
  }

  const form = new FormData();
  form.append("photo", input.file);
  const contextPayload = {
    desiredProduct: input.desiredProduct ?? null,
    projectNotes: input.projectNotes ?? null,
    keywords: input.keywords && input.keywords.length ? input.keywords : null,
  };
  form.append("context", JSON.stringify(contextPayload));

  return apiFetch<InspirationAnalysisResponse>("/measurements/inspiration/from-photo", {
    method: "POST",
    body: form as any,
  } as any);
}
