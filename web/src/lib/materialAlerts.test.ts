import { deriveLineMaterialAlerts } from './materialAlerts';

interface Line { id: string; description: string; }
interface CostEntry {
  id: string;
  materialCode: string | null;
  materialLabel: string | null;
  supplierName: string | null;
  previousUnitPrice: number | null;
  currentUnitPrice: number | null;
  changePercent: number | null;
  currency: string | null;
  changedAt: string | null;
}

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

(function runTests() {
  // Case 1: empty inputs
  let alerts = deriveLineMaterialAlerts([], [], {});
  assert(alerts.length === 0, 'Expected no alerts for empty input');

  // Prepare sample lines
  const lines: Line[] = [
    { id: 'l1', description: 'Accoya prime boards 4m length' },
    { id: 'l2', description: 'Supply white oak structural beam 3m' },
    { id: 'l3', description: 'lamnated pime panell 2400x600 (custom finish)' },
  ];

  // Cost entries including direct code, token and fuzzy labels
  const costs: CostEntry[] = [
    {
      id: 'c1', materialCode: 'accoya', materialLabel: 'Accoya timber', supplierName: 'WoodCo', previousUnitPrice: 10,
      currentUnitPrice: 10.1, changePercent: 1, currency: 'GBP', changedAt: new Date().toISOString()
    },
    {
      id: 'c2', materialCode: null, materialLabel: 'white oak beam', supplierName: 'OakSup', previousUnitPrice: 30,
      currentUnitPrice: 31.5, changePercent: 5, currency: 'GBP', changedAt: new Date().toISOString()
    },
    {
      id: 'c3', materialCode: null, materialLabel: 'laminated pine panel', supplierName: 'PineWorks', previousUnitPrice: 20,
      currentUnitPrice: 25, changePercent: 25, currency: 'GBP', changedAt: new Date().toISOString()
    }
  ];

  alerts = deriveLineMaterialAlerts(lines as any, costs as any, { minPercent: 3, fuzzyThreshold: 0.74 });

  // Expect 3 alerts total (all match somehow)
  assert(alerts.length === 3, `Expected 3 alerts, got ${alerts.length}`);

  const accoya = alerts.find(a => a.id === 'c1');
  assert(accoya, 'Accoya alert missing');
  assert(accoya!.matchedCode, 'Accoya should match by code');
  assert(accoya!.significant === true, 'Code match should mark significant even with small percent');

  const oak = alerts.find(a => a.id === 'c2');
  assert(oak, 'Oak alert missing');
  assert(oak!.matchedTokens.some(t => t.includes('white')), 'Oak should include token white');
  assert(oak!.matchedTokens.some(t => t.includes('oak')), 'Oak should include token oak');
  assert(oak!.matchedTokens.some(t => t.includes('beam')), 'Oak should include token beam');

  const pine = alerts.find(a => a.id === 'c3');
  assert(pine, 'Pine alert missing');
  // Fuzzy tokens expected e.g. laminated~lamnated, pine~pime, panel~panell
  const fuzzyNeeded = ['laminated', 'pine', 'panel'];
  for (const base of fuzzyNeeded) {
    assert(
      pine!.matchedTokens.some(t => t.startsWith(base + '~')),
      `Expected fuzzy match for ${base}`
    );
  }

  console.log('materialAlerts tests passed (', alerts.length, 'alerts )');
})();
