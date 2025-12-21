import { describe, expect, it } from '@jest/globals';
import { estimateTokensFromText, estimateTokensFromCounts, estimateCostUsd, convertUsdToGbp } from '../pricing';

describe('pricing estimators', () => {
  it('estimates tokens from text', () => {
    expect(estimateTokensFromText('')).toBe(0);
    expect(estimateTokensFromText('abcd')).toBe(1);
    expect(estimateTokensFromText('a'.repeat(8))).toBe(2);
  });

  it('estimates tokens from counts', () => {
    expect(estimateTokensFromCounts({ chars: 0, images: 1, pdfPages: 0 })).toBe(500);
    expect(estimateTokensFromCounts({ chars: 400, images: 0, pdfPages: 1 })).toBe(1100);
  });

  it('estimates cost usd with model pricing', () => {
    const usd = estimateCostUsd('gpt-4o-mini', 1000, 2000);
    // input: 1000 * 0.15/1e6 = 0.00015; output: 2000 * 0.6/1e6 = 0.0012 => 0.00135
    expect(usd).toBeCloseTo(0.00135, 5);
  });

  it('converts usd to gbp using default rate', () => {
    const gbp = convertUsdToGbp(1, 0.8);
    expect(gbp).toBe(0.8);
  });
});
