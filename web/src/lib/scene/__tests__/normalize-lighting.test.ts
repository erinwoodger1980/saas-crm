/**
 * Test: Lighting Config Normalization
 * Ensures malformed lighting data doesn't crash the configurator
 */

import { normalizeLightingConfig, createLightingFromDimensions } from '../normalize-lighting';

describe('normalizeLightingConfig', () => {
  it('should handle valid config', () => {
    const valid = {
      boundsX: [-750, 750] as [number, number],
      boundsZ: [-750, 750] as [number, number],
      intensity: 1.6,
      shadowCatcherDiameter: 3000,
      ambientIntensity: 0.45,
      castShadows: true,
    };
    
    const result = normalizeLightingConfig(valid);
    
    expect(result.boundsX).toEqual([-750, 750]);
    expect(result.boundsZ).toEqual([-750, 750]);
    expect(result.intensity).toBe(1.6);
    expect(result.shadowCatcherDiameter).toBe(3000);
    expect(result.ambientIntensity).toBe(0.45);
    expect(result.castShadows).toBe(true);
  });
  
  it('should handle malformed boundsX (number instead of tuple)', () => {
    const malformed = {
      boundsX: 67.5, // BUG: single number instead of [number, number]
      boundsZ: [-750, 750] as [number, number],
      intensity: 1.6,
      shadowCatcherDiameter: 3000,
      ambientIntensity: 0.45,
      castShadows: true,
    };
    
    const result = normalizeLightingConfig(malformed as any);
    
    // Should fall back to default
    expect(result.boundsX).toEqual([-750, 750]);
    expect(result.intensity).toBe(1.6);
  });
  
  it('should handle missing fields', () => {
    const partial = {
      intensity: 2.0,
    };
    
    const result = normalizeLightingConfig(partial);
    
    expect(result.boundsX).toEqual([-750, 750]);
    expect(result.boundsZ).toEqual([-750, 750]);
    expect(result.intensity).toBe(2.0);
    expect(result.shadowCatcherDiameter).toBe(3000);
    expect(result.ambientIntensity).toBe(0.45);
    expect(result.castShadows).toBe(true);
  });
  
  it('should handle null/undefined input', () => {
    const resultNull = normalizeLightingConfig(null);
    const resultUndefined = normalizeLightingConfig(undefined);
    
    expect(resultNull.boundsX).toEqual([-750, 750]);
    expect(resultUndefined.boundsX).toEqual([-750, 750]);
  });
  
  it('should handle invalid types', () => {
    const invalid = {
      boundsX: "invalid", // string instead of tuple
      boundsZ: [null, undefined], // invalid tuple values
      intensity: -5, // invalid (must be positive)
      shadowCatcherDiameter: NaN,
      ambientIntensity: "0.5", // string instead of number
      castShadows: "yes", // string instead of boolean
    };
    
    const result = normalizeLightingConfig(invalid as any);
    
    // All should fall back to defaults
    expect(result.boundsX).toEqual([-750, 750]);
    expect(result.boundsZ).toEqual([-750, 750]);
    expect(result.intensity).toBe(1.6); // falls back because -5 is invalid
    expect(result.shadowCatcherDiameter).toBe(3000);
    expect(result.ambientIntensity).toBe(0.45);
    expect(result.castShadows).toBe(true); // non-boolean defaults to true
  });
});

describe('createLightingFromDimensions', () => {
  it('should create valid lighting from door dimensions', () => {
    const result = createLightingFromDimensions(914, 2032, 45);
    
    expect(result.boundsX).toHaveLength(2);
    expect(result.boundsZ).toHaveLength(2);
    expect(result.boundsX[0]).toBeLessThan(0);
    expect(result.boundsX[1]).toBeGreaterThan(0);
    expect(result.shadowCatcherDiameter).toBeGreaterThan(0);
    expect(result.intensity).toBe(1.6);
    expect(result.castShadows).toBe(true);
  });
  
  it('should create valid lighting from window dimensions', () => {
    const result = createLightingFromDimensions(1200, 1200, 100);
    
    expect(result.boundsX[1] - result.boundsX[0]).toBeCloseTo(1200 * 1.5 * 2, 1);
    expect(result.boundsZ[1] - result.boundsZ[0]).toBeCloseTo(100 * 1.5 * 2, 1);
  });
});
