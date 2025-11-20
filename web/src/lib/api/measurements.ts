import { apiFetch } from "@/lib/api";

export type PhotoMeasurementResponse = {
  width_mm: number | null;
  height_mm: number | null;
  confidence: number | null;
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
