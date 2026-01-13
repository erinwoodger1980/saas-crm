import {
  linePriceFeatureHash,
  linePriceSpecHash,
  normaliseLinePriceFeatures,
  scaleUnitNetGBPByArea,
} from "../src/lib/ml/linePriceOverrides";

describe("line price overrides", () => {
  it("spec hash ignores dimensions", () => {
    const tenantId = "t1";
    const a = normaliseLinePriceFeatures({
      productType: "Door",
      timber: "Accoya",
      finish: "primed",
      glazing: "double glazed",
      ironmongery: "lock",
      widthMm: 1000,
      heightMm: 2100,
    });
    const b = normaliseLinePriceFeatures({
      productType: "Door",
      timber: "Accoya",
      finish: "primed",
      glazing: "double glazed",
      ironmongery: "lock",
      widthMm: 1200,
      heightMm: 2400,
    });

    expect(linePriceSpecHash(tenantId, a)).toBe(linePriceSpecHash(tenantId, b));
    expect(linePriceFeatureHash(tenantId, a)).not.toBe(linePriceFeatureHash(tenantId, b));
  });

  it("area scaling clamps at maxScale", () => {
    const scaled = scaleUnitNetGBPByArea({
      baseUnitNetGBP: 100,
      baseWidthMm: 1000,
      baseHeightMm: 1000,
      widthMm: 2000,
      heightMm: 2000,
    });
    // 4x area would be 400, but clamp to 3x => 300
    expect(scaled).toBeTruthy();
    expect(scaled!.scale).toBe(3.0);
    expect(scaled!.unitNetGBP).toBe(300);
  });

  it("area scaling clamps at minScale", () => {
    const scaled = scaleUnitNetGBPByArea({
      baseUnitNetGBP: 100,
      baseWidthMm: 1000,
      baseHeightMm: 1000,
      widthMm: 100,
      heightMm: 100,
    });
    // 0.01x area would be 1, but clamp to 0.4x => 40
    expect(scaled).toBeTruthy();
    expect(scaled!.scale).toBe(0.4);
    expect(scaled!.unitNetGBP).toBe(40);
  });

  it("returns null for invalid dimensions", () => {
    const scaled = scaleUnitNetGBPByArea({
      baseUnitNetGBP: 100,
      baseWidthMm: 0,
      baseHeightMm: 1000,
      widthMm: 1000,
      heightMm: 1000,
    });
    expect(scaled).toBeNull();
  });
});
