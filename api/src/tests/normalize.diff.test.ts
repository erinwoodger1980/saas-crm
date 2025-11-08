import { normalizeDiffPaths } from '../services/git/normalize';
import path from 'path';
import fs from 'fs';

const repoRoot = path.resolve(__dirname, '../../tmp/normalize-fixtures');

beforeAll(() => {
  fs.rmSync(repoRoot, { recursive: true, force: true });
  fs.mkdirSync(repoRoot, { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'web/src/app/dashboard'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'web/src/app/dashboard/page.tsx'), 'export default function Page(){}');
});

describe('normalizeDiffPaths', () => {
  test('invented dashboard.tsx rewrites to dashboard/page.tsx', () => {
    const diff = [
      '--- a/web/src/app/dashboard.tsx',
      '+++ b/web/src/app/dashboard.tsx',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
    ].join('\n');
    const { diff: out, warnings } = normalizeDiffPaths(diff, null, repoRoot);
    expect(out).toMatch(/a\/web\/src\/app\/dashboard\/page.tsx/);
    expect(warnings.length).toBeGreaterThan(0);
  });

  test('unknown path throws', () => {
    const diff = [
      '--- a/web/src/app/does-not-exist/file.tsx',
      '+++ b/web/src/app/does-not-exist/file.tsx',
      '@@ -1,1 +1,1 @@',
      '-x',
      '+y',
    ].join('\n');
    expect(() => normalizeDiffPaths(diff, null, repoRoot)).toThrow(/PATH_NOT_FOUND|not found/);
  });
});
