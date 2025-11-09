import { isUnifiedDiff, ensureDiffPrefixes, DIFF_CONTRACT_INSTRUCTIONS } from '../src/services/ai/diffContract';

describe('diffContract', () => {
  it('isUnifiedDiff returns true for valid unified diff', () => {
    const diff = [
      '--- a/app/example.txt',
      '+++ b/app/example.txt',
      '@@ -1,2 +1,3 @@',
      '-old line',
      '+new line',
      ' unchanged',
    ].join('\n');
    expect(isUnifiedDiff(diff)).toBe(true);
  });

  it('isUnifiedDiff returns false for prose', () => {
    const prose = 'This is not a diff. Just some text.';
    expect(isUnifiedDiff(prose)).toBe(false);
  });

  it('isUnifiedDiff returns false for code block', () => {
    const code = '```js\nconsole.log(123);\n```';
    expect(isUnifiedDiff(code)).toBe(false);
  });

  it('ensureDiffPrefixes adds a/ and b/ prefixes', () => {
    const diff = [
      '--- example.txt',
      '+++ example.txt',
      '@@ -1,2 +1,3 @@',
      '-old line',
      '+new line',
      ' unchanged',
    ].join('\n');
    const fixed = ensureDiffPrefixes(diff);
    expect(fixed).toContain('--- a/example.txt');
    expect(fixed).toContain('+++ b/example.txt');
  });

  it('ensureDiffPrefixes does not double prefix', () => {
    const diff = [
      '--- a/example.txt',
      '+++ b/example.txt',
      '@@ -1,2 +1,3 @@',
      '-old line',
      '+new line',
      ' unchanged',
    ].join('\n');
    const fixed = ensureDiffPrefixes(diff);
    expect(fixed.match(/--- a\/example.txt/g)?.length).toBe(1);
    expect(fixed.match(/\+\+\+ b\/example.txt/g)?.length).toBe(1);
  });

  it('DIFF_CONTRACT_INSTRUCTIONS contains contract keywords', () => {
    expect(DIFF_CONTRACT_INSTRUCTIONS).toContain('CONTRACT:');
    expect(DIFF_CONTRACT_INSTRUCTIONS).toContain('Output ONLY a POSIX unified diff');
    expect(DIFF_CONTRACT_INSTRUCTIONS).toContain('--- a/<path>');
    expect(DIFF_CONTRACT_INSTRUCTIONS).toContain('+++ b/<path>');
    expect(DIFF_CONTRACT_INSTRUCTIONS).toContain('@@ -<old> +<new> @@');
  });
});
