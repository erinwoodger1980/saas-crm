/**
 * Quick Test Suite for AI Template System
 * Run with: npx tsx web/src/lib/scene/__tests__/ai-template-system.test.ts
 */

import { evaluateExpression, evaluateDims, flattenGlobals } from '../expression-eval';
import { resolveProductComplete } from '../resolve-product';
import { buildSceneFromResolvedProduct } from '../scene-builder';
import { generateBom } from '../../costing/bom';
import { generateCutlist } from '../../costing/cutlist';
import { generatePricing, estimateLaborHours } from '../../costing/pricing';
import { doorEntranceE01Template } from '../templates/door-entrance-e01';

// Test 1: Expression Evaluator
console.log('\n=== Test 1: Expression Evaluator ===');
const context = { globals: { pw: 926, stileW: 115, ph: 2032 } };

const test1_1 = evaluateExpression('#pw', context);
console.log(`#pw = ${test1_1}`, test1_1 === 926 ? '✅' : '❌');

const test1_2 = evaluateExpression('#pw - #stileW * 2', context);
console.log(`#pw - #stileW * 2 = ${test1_2}`, test1_2 === 696 ? '✅' : '❌');

const test1_3 = evaluateExpression('(#ph - 100) / 10', context);
console.log(`(#ph - 100) / 10 = ${test1_3}`, test1_3 === 193.2 ? '✅' : '❌');

// Test 2: Dimension Evaluation
console.log('\n=== Test 2: Dimension Evaluation ===');
const dims = evaluateDims({ x: '#stileW', y: '#ph', z: '54' }, context);
console.log(`Dims: x=${dims.x}, y=${dims.y}, z=${dims.z}`);
console.log(dims.x === 115 && dims.y === 2032 && dims.z === 54 ? '✅' : '❌');

// Test 3: Product Resolution
console.log('\n=== Test 3: Product Resolution ===');
(async () => {
  try {
    const product = await resolveProductComplete(doorEntranceE01Template);
    
    console.log(`Template: ${product.templateId}`);
    console.log(`Components: ${product.instances.length}`);
    console.log(`Globals: ${Object.keys(product.globals).length}`);
    console.log(`Materials: ${product.materials.length}`);
    console.log(`Hardware: ${product.hardware.length}`);
    console.log(product.instances.length >= 10 ? '✅ Component count' : '❌');
    
    // Test 4: BOM Generation
    console.log('\n=== Test 4: BOM Generation ===');
    console.log(`BOM lines: ${product.bom.length}`);
    console.log(product.bom.length > 0 ? '✅ BOM generated' : '❌');
    
    if (product.bom.length > 0) {
      const sampleBom = product.bom[0];
      console.log(`  Sample: ${sampleBom.componentName} - ${sampleBom.quantity.toFixed(2)} ${sampleBom.unit}`);
    }
    
    // Test 5: Cutlist Generation
    console.log('\n=== Test 5: Cutlist Generation ===');
    console.log(`Cutlist lines: ${product.cutList.length}`);
    console.log(product.cutList.length > 0 ? '✅ Cutlist generated' : '❌');
    
    if (product.cutList.length > 0) {
      const sampleCut = product.cutList[0];
      console.log(`  Sample: ${sampleCut.componentName} - ${sampleCut.lengthMm}mm x ${sampleCut.quantity} pcs`);
    }
    
    // Test 6: Pricing
    console.log('\n=== Test 6: Pricing Calculation ===');
    console.log(`Materials: £${product.pricing.materials.toFixed(2)}`);
    console.log(`Hardware: £${product.pricing.hardware.toFixed(2)}`);
    console.log(`Finishing: £${product.pricing.finishing.toFixed(2)}`);
    console.log(`Markup: £${product.pricing.markup?.toFixed(2)}`);
    console.log(`Tax: £${product.pricing.tax?.toFixed(2)}`);
    console.log(`TOTAL: £${product.pricing.total.toFixed(2)}`);
    console.log(product.pricing.total > 0 ? '✅ Pricing calculated' : '❌');
    
    // Test 7: Labor Estimation
    console.log('\n=== Test 7: Labor Estimation ===');
    const hours = estimateLaborHours(product);
    console.log(`Estimated hours: ${hours}`);
    console.log(hours > 0 ? '✅ Labor estimated' : '❌');
    
    // Test 8: Scene Building
    console.log('\n=== Test 8: Scene Building ===');
    const scene = buildSceneFromResolvedProduct(product);
    console.log(`Scene version: ${scene.version}`);
    console.log(`Components: ${scene.components.length}`);
    console.log(`Materials: ${scene.materials.length}`);
    console.log(`Camera mode: ${scene.camera.mode}`);
    console.log(`Dimensions: ${scene.dimensions.width}x${scene.dimensions.height}x${scene.dimensions.depth}mm`);
    console.log(scene.components.length > 0 ? '✅ Scene built' : '❌');
    
    // Test 9: Specific Component Check
    console.log('\n=== Test 9: Component Verification ===');
    const leftStile = product.instances.find(i => i.id === 'stile_left');
    if (leftStile) {
      console.log(`Left Stile: ${leftStile.dimsMm.x}x${leftStile.dimsMm.y}x${leftStile.dimsMm.z}mm`);
      console.log(`Position: (${leftStile.posMm.x}, ${leftStile.posMm.y}, ${leftStile.posMm.z})`);
      console.log(`Material: ${leftStile.materialKey}`);
      console.log(leftStile.dimsMm.y === 2032 ? '✅ Stile height correct' : '❌');
    }
    
    const midRail = product.instances.find(i => i.id === 'rail_mid');
    if (midRail) {
      console.log(`Mid Rail width: ${midRail.dimsMm.x}mm`);
      const expectedWidth = 926 - 115 * 2; // pw - stileW * 2
      console.log(midRail.dimsMm.x === expectedWidth ? '✅ Rail width expression correct' : '❌');
    }
    
    // Test 10: Global Parameter Access
    console.log('\n=== Test 10: Global Parameters ===');
    console.log(`Product width (pw): ${product.globals.pw}mm`);
    console.log(`Product height (ph): ${product.globals.ph}mm`);
    console.log(`Stile width: ${product.globals.stileW}mm`);
    console.log(product.globals.pw === 926 ? '✅ Globals preserved' : '❌');
    
    console.log('\n=== All Tests Complete ===\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  }
})();
