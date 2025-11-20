import {
  MIN_DIMENSION_MM,
  MAX_DIMENSION_MM,
  normalizeVisionEstimate,
  parseVisionResponseText,
} from "@/lib/vision/photoMeasurement";

describe("photo measurement helpers", () => {
  it("parses fenced JSON blocks", () => {
    const raw = "```json\n{\"width_mm\": 950, \"height_mm\": 2010, \"confidence\": 0.71}\n```";
    const parsed = parseVisionResponseText(raw);
    expect(parsed).toEqual({ width_mm: 950, height_mm: 2010, confidence: 0.71 });
  });

  it("normalizes, clamps, and rounds dimensions", () => {
    const result = normalizeVisionEstimate({ width_mm: 1234.4, height_mm: 4123, confidence: 1.2 });
    expect(result.widthMm).toBe(1230); // nearest 10
    expect(result.heightMm).toBe(MAX_DIMENSION_MM);
    expect(result.confidence).toBe(1);
  });

  it("handles missing values and coerces strings", () => {
    const payload = { width: "100mm", height: "--", confidence_score: "0.12" };
    const result = normalizeVisionEstimate(payload as any);
    expect(result.widthMm).toBe(MIN_DIMENSION_MM);
    expect(result.heightMm).toBeNull();
    expect(result.confidence).toBe(0.12);
  });
});
