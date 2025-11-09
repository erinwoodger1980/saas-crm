import { extractErrorHints } from '../src/services/retriever/errors';

describe('extractErrorHints', () => {
  it('extracts TypeScript error with parentheses format', () => {
    const logs = `
src/components/Button.tsx(42,13): error TS2307: Cannot find module 'react'
src/lib/utils.ts(123,5): error TS2322: Type 'string' is not assignable
    `;
    
    const hints = extractErrorHints(logs);
    
    expect(hints.length).toBeGreaterThanOrEqual(2);
    expect(hints[0]).toMatchObject({
      path: expect.stringContaining('Button.tsx'),
      line: 42,
      col: 13,
    });
  });
  
  it('extracts stack trace format', () => {
    const logs = `
Error: Cannot find module
    at Module._resolveFilename (internal/modules/cjs/loader.js:880:15)
    at Function.Module._load (src/services/api.ts:123:5)
    at Module.require (src/app/page.tsx:45:10)
    `;
    
    const hints = extractErrorHints(logs);
    
    expect(hints.length).toBeGreaterThanOrEqual(2);
    expect(hints.some(h => h.path.includes('api.ts'))).toBe(true);
    expect(hints.some(h => h.path.includes('page.tsx'))).toBe(true);
  });
  
  it('extracts simple path:line:col format', () => {
    const logs = `
api/src/routes/quotes.ts:42:13 - error TS2307
web/src/app/dashboard/page.tsx:100:5 - error TS2322
    `;
    
    const hints = extractErrorHints(logs);
    
    expect(hints.length).toBeGreaterThanOrEqual(2);
    expect(hints[0].path).toContain('quotes.ts');
    expect(hints[0].line).toBe(42);
    expect(hints[1].path).toContain('page.tsx');
  });
  
  it('deduplicates same file:line', () => {
    const logs = `
src/file.ts:42:13 - error TS2307
src/file.ts:42:13 - error TS2322
src/file.ts:42:20 - error TS2345
    `;
    
    const hints = extractErrorHints(logs);
    
    // Should dedupe same line (even with different columns)
    expect(hints.length).toBe(1);
    expect(hints[0].line).toBe(42);
  });
  
  it('normalizes paths to POSIX relative', () => {
    const logs = `
/absolute/path/to/saas-crm/api/src/file.ts:42:13
file:///path/to/web/src/app/page.tsx:100:5
    `;
    
    const hints = extractErrorHints(logs);
    
    // Should strip absolute prefixes
    hints.forEach(hint => {
      expect(hint.path).not.toMatch(/^\/|^file:/);
    });
  });
  
  it('filters out node_modules paths', () => {
    const logs = `
src/file.ts:42:13
node_modules/package/index.js:100:5
src/other.ts:50:10
    `;
    
    const hints = extractErrorHints(logs);
    
    // Should not include node_modules
    expect(hints.every(h => !h.path.includes('node_modules'))).toBe(true);
  });
});
