import fs from 'fs';
import path from 'path';
import { normalizeDiffPaths } from '../src/services/git/normalize';

const FIXTURES_DIR = path.join(__dirname, '../tmp/normalize-alias-fixtures');
const REPO_ROOT = FIXTURES_DIR;

describe('normalizeDiffPaths with alias map', () => {
  beforeAll(async () => {
    // Create test fixtures directory structure
    await fs.promises.mkdir(path.join(FIXTURES_DIR, 'app/(admin)/dashboard'), { recursive: true });
    await fs.promises.mkdir(path.join(FIXTURES_DIR, 'app/(admin)/_components'), { recursive: true });
    await fs.promises.mkdir(path.join(FIXTURES_DIR, 'app/api/test'), { recursive: true });
    await fs.promises.mkdir(path.join(FIXTURES_DIR, '.saferun'), { recursive: true });
    
    // Create actual files
    await fs.promises.writeFile(
      path.join(FIXTURES_DIR, 'app/(admin)/dashboard/page.tsx'),
      'export default function Dashboard() { return <div>Dashboard</div>; }'
    );
    await fs.promises.writeFile(
      path.join(FIXTURES_DIR, 'app/(admin)/_components/AdminNav.tsx'),
      'export function AdminNav() { return <nav>Nav</nav>; }'
    );
    await fs.promises.writeFile(
      path.join(FIXTURES_DIR, 'app/api/test/route.ts'),
      'export async function GET() { return Response.json({}); }'
    );
    
    // Create alias config
    await fs.promises.writeFile(
      path.join(FIXTURES_DIR, '.saferun/path-aliases.json'),
      JSON.stringify({
        aliases: {
          'web/src/app/admin/dashboard/page.tsx': 'app/(admin)/dashboard/page.tsx',
          'src/admin/dashboard.js': 'app/(admin)/dashboard/page.tsx',
          'src/components/AdminNav.tsx': 'app/(admin)/_components/AdminNav.tsx',
          'web/src/app/**': 'app/**'
        }
      })
    );
  });
  
  afterAll(async () => {
    await fs.promises.rm(FIXTURES_DIR, { recursive: true, force: true });
  });
  
  it('rewrites exact alias match', () => {
    const diff = `
--- a/web/src/app/admin/dashboard/page.tsx
+++ b/web/src/app/admin/dashboard/page.tsx
@@ -1,1 +1,1 @@
-old
+new
    `.trim();
    
    const result = normalizeDiffPaths(diff, ['app/**'], REPO_ROOT);
    
    expect(result.diff).toContain('--- a/app/(admin)/dashboard/page.tsx');
    expect(result.diff).toContain('+++ b/app/(admin)/dashboard/page.tsx');
    expect(result.warnings).toContainEqual(
      expect.stringMatching(/normalized.*alias/)
    );
  });
  
  it('rewrites legacy path with different extension', () => {
    const diff = `
--- a/src/admin/dashboard.js
+++ b/src/admin/dashboard.js
@@ -1,1 +1,1 @@
-old
+new
    `.trim();
    
    const result = normalizeDiffPaths(diff, ['app/**'], REPO_ROOT);
    
    expect(result.diff).toContain('app/(admin)/dashboard/page.tsx');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  
  it('strips web/src/ prefix', () => {
    const diff = `
--- a/web/src/app/api/test/route.ts
+++ b/web/src/app/api/test/route.ts
@@ -1,1 +1,1 @@
-old
+new
    `.trim();
    
    const result = normalizeDiffPaths(diff, ['app/**'], REPO_ROOT);
    
    expect(result.diff).toContain('--- a/app/api/test/route.ts');
    expect(result.diff).toContain('+++ b/app/api/test/route.ts');
    expect(result.warnings).toContainEqual(
      expect.stringMatching(/normalized/)
    );
  });
  
  it('performs case-insensitive match', () => {
    const diff = `
--- a/APP/(ADMIN)/DASHBOARD/PAGE.TSX
+++ b/APP/(ADMIN)/DASHBOARD/PAGE.TSX
@@ -1,1 +1,1 @@
-old
+new
    `.trim();
    
    const result = normalizeDiffPaths(diff, ['app/**'], REPO_ROOT);
    
    // Should resolve to actual case
    expect(result.diff).toContain('app/(admin)/dashboard/page.tsx');
    expect(result.warnings).toContainEqual(
      expect.stringMatching(/normalized.*case/)
    );
  });
  
  it('applies fuzzy match with same directory', () => {
    const diff = `
--- a/app/(admin)/dashboard/pag.tsx
+++ b/app/(admin)/dashboard/pag.tsx
@@ -1,1 +1,1 @@
-old
+new
    `.trim();
    
    const result = normalizeDiffPaths(diff, ['app/**'], REPO_ROOT);
    
    // Should resolve to page.tsx (distance=2)
    expect(result.diff).toContain('app/(admin)/dashboard/page.tsx');
    expect(result.warnings).toContainEqual(
      expect.stringMatching(/normalized/)
    );
  });
  
  it('does not rewrite to non-allowlisted path', () => {
    const diff = `
--- a/api/restricted/secret.ts
+++ b/api/restricted/secret.ts
@@ -1,1 +1,1 @@
-old
+new
    `.trim();
    
    // Only allow app/** but try to access api/**
    expect(() => {
      normalizeDiffPaths(diff, ['app/**'], REPO_ROOT);
    }).toThrow(expect.objectContaining({
      message: expect.stringMatching(/not found and no safe match/)
    }));
  });
  
  it('respects PATH_ALIAS_ENABLED=false', () => {
    // Save original env
    const originalEnv = process.env.PATH_ALIAS_ENABLED;
    process.env.PATH_ALIAS_ENABLED = 'false';
    
    try {
      const diff = `
--- a/some/unknown/path/file.tsx
+++ b/some/unknown/path/file.tsx
@@ -1,1 +1,1 @@
-old
+new
      `.trim();
      
      // Should fail because path doesn't exist and aliases are disabled
      expect(() => {
        normalizeDiffPaths(diff, ['app/**'], REPO_ROOT);
      }).toThrow(expect.objectContaining({
        message: expect.stringMatching(/not found/)
      }));
    } finally {
      // Restore env
      if (originalEnv !== undefined) {
        process.env.PATH_ALIAS_ENABLED = originalEnv;
      } else {
        delete process.env.PATH_ALIAS_ENABLED;
      }
    }
  });
  
  it('applies wildcard alias patterns', () => {
    const diff = `
--- a/web/src/app/api/test/route.ts
+++ b/web/src/app/api/test/route.ts
@@ -1,1 +1,1 @@
-old
+new
    `.trim();
    
    const result = normalizeDiffPaths(diff, ['app/**'], REPO_ROOT);
    
    // web/src/app/** -> app/** should work
    expect(result.diff).toContain('app/api/test/route.ts');
    expect(result.warnings).toContainEqual(
      expect.stringMatching(/normalized/)
    );
  });
  
  it('converts filename to App Router page pattern', () => {
    const diff = `
--- a/app/(admin)/dashboard.tsx
+++ b/app/(admin)/dashboard.tsx
@@ -1,1 +1,1 @@
-old
+new
    `.trim();
    
    const result = normalizeDiffPaths(diff, ['app/**'], REPO_ROOT);
    
    // dashboard.tsx -> dashboard/page.tsx
    expect(result.diff).toContain('app/(admin)/dashboard/page.tsx');
    expect(result.warnings).toContainEqual(
      expect.stringMatching(/normalized.*filename/)
    );
  });
  
  it('logs warnings for each rewrite', () => {
    const diff = `
--- a/web/src/app/admin/dashboard/page.tsx
+++ b/web/src/app/admin/dashboard/page.tsx
@@ -1,1 +1,1 @@
-old
+new
    `.trim();
    
    const result = normalizeDiffPaths(diff, ['app/**'], REPO_ROOT);
    
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/normalized:/);
    expect(result.warnings[0]).toContain('app/(admin)/dashboard/page.tsx');
  });
  
  it('does not fuzzy match across different directories', () => {
    const diff = `
--- a/app/api/page.tsx
+++ b/app/api/page.tsx
@@ -1,1 +1,1 @@
-old
+new
    `.trim();
    
    // page.tsx exists in app/(admin)/dashboard/ but not in app/api/
    expect(() => {
      normalizeDiffPaths(diff, ['app/**'], REPO_ROOT);
    }).toThrow(expect.objectContaining({
      message: expect.stringMatching(/not found and no safe match/)
    }));
  });
});
