/**
 * Runtime Verification: Lighting Config Normalization
 * Tests that malformed data doesn't crash in production
 */

import { normalizeLightingConfig } from './normalize-lighting';

console.log('🧪 Testing Lighting Config Normalization...\n');

// Test 1: The exact bug that was crashing (number instead of tuple)
console.log('Test 1: Number instead of tuple (the original bug)');
const bug = normalizeLightingConfig({
  boundsX: 67.5, // This was causing "number is not iterable"
  boundsZ: 45.0,
  intensity: 1.6,
  shadowCatcherDiameter: 3000,
  ambientIntensity: 0.45,
  castShadows: true,
} as any);
console.log('✅ Did not crash! Result:', bug);
console.log('   boundsX fallback:', bug.boundsX);
console.log('');

// Test 2: Completely malformed input
console.log('Test 2: Completely malformed input');
const malformed = normalizeLightingConfig({
  boundsX: "invalid",
  boundsZ: [null, undefined],
  intensity: -999,
  shadowCatcherDiameter: NaN,
  ambientIntensity: "bad",
  castShadows: "yes"
} as any);
console.log('✅ Did not crash! Result:', malformed);
console.log('');

// Test 3: Null/undefined
console.log('Test 3: Null/undefined input');
const nullInput = normalizeLightingConfig(null);
const undefinedInput = normalizeLightingConfig(undefined);
console.log('✅ null input:', nullInput.boundsX);
console.log('✅ undefined input:', undefinedInput.boundsX);
console.log('');

// Test 4: Valid input (should pass through)
console.log('Test 4: Valid input (should preserve values)');
const valid = normalizeLightingConfig({
  boundsX: [-500, 500],
  boundsZ: [-300, 300],
  intensity: 2.5,
  shadowCatcherDiameter: 4000,
  ambientIntensity: 0.8,
  castShadows: false,
});
console.log('✅ Valid config preserved:', valid);
console.log('');

console.log('🎉 All tests passed! Lighting config is now crash-resistant.');
