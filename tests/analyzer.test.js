import { describe, it, expect } from 'vitest';
import { analyze } from '../src/js/analyzer.js';
import { parseCsv } from '../src/js/csv-parser.js';
import { planCleaning, cleanedCsv, findingsCsv } from '../src/js/exporter.js';
const run = (csv, o, p) => analyze(parseCsv(csv, p), o);
const of = (r, type, col) => r.findings.find((f) => f.type === type && (!col || f.column === col));
describe('analyze', () => {
  it('reports missing values with count and percent, honoring tokens', () => {
    const csv = 'a,b\n1,x\n,N/A\n3,-\n4,y';
    const f = of(run(csv), 'missing', 'b'); expect(f.count).toBe(2); expect(f.pct).toBe(50);
    expect(of(run(csv, { useTokens: false }), 'missing', 'b')).toBeUndefined();
    expect(of(run(csv, { tokens: ['x'] }), 'missing', 'b').rows).toEqual([0]);
  });
  it('detects duplicates and supports ignored columns', () => {
    const csv = 'id,v\n1,a\n2,a\n1,a';
    const f = of(run(csv), 'duplicates'); expect(f.rows).toEqual([2]); expect(f.examples[0]).toContain('row 1');
    expect(of(run(csv, { ignoreCols: ['id'] }), 'duplicates').rows).toEqual([1, 2]);
  });
  it('finds case and whitespace inconsistencies without changing data', () => {
    const t = parseCsv('c\nKosovo\nkosovo\nKOSOVO \nKosovo'); const r = analyze(t);
    expect(of(r, 'case').normalize['kosovo']).toBe('Kosovo'); expect(of(r, 'whitespace').rows).toEqual([2]); expect(t.rows[2][0]).toBe('KOSOVO ');
  });
  it('detects mixed types and reports non-matching examples', () => {
    const f = of(run('n\n1\n2\n3\n4\n5\n6\n7\n8\n9\nabc'), 'types', 'n'); expect(f.rows).toEqual([9]); expect(f.examples[0]).toContain('abc');
  });
  it('validates emails only in email columns', () => {
    const r = run('email,note\na@b.com,hi\nbad,a@b\nx@y.org,z'); expect(of(r, 'email', 'email').rows).toEqual([1]); expect(of(r, 'email', 'note')).toBeUndefined();
  });
  it('flags uneven rows, constant and mostly-empty columns', () => {
    const r = run('a,b,c\n1,k,\n2,k\n3,k,,9'); expect(of(r, 'rowLength').rows).toEqual([1, 2]);
    expect(of(r, 'constant', 'b')).toBeTruthy(); expect(of(r, 'highMissing', 'c')).toBeTruthy();
  });
  it('individual checks can be disabled', () => { expect(run('a\n,\n', { checks: { missing: false, highMissing: false } }).findings.some((f) => f.type === 'missing')).toBe(false); });
  it('score is 100 for clean data and N/A for zero rows', () => {
    expect(run('a,b\n1,x\n2,y').summary.score).toBe(100); expect(run('a,b').summary.score).toBeNull();
  });
  it('score drops with flagged cells', () => { expect(run('a,b\n1,x\n,y\n3,z\n4,w').summary.score).toBeLessThan(100); });
  it('cleaned export applies only selected transformations and preserves leading zeros', () => {
    const t = parseCsv('id,c\n00123, Kosovo\n00124,kosovo\n00125,Kosovo'); const r = analyze(t);
    expect(planCleaning(t, r, {}).changes).toHaveLength(0);
    expect(planCleaning(t, r, { trim: true }).changes).toHaveLength(1);
    const out = cleanedCsv(t, r, { trim: true, normalizeCase: true }); expect(out).toContain('00123,Kosovo'); expect(out).toContain('00124,Kosovo');
  });
  it('findings CSV escapes and guards formulas', () => { expect(findingsCsv([{ id: 1, severity: 'error', type: 'x', column: '=evil', count: 1, rows: [0], message: 'a,b', suggestion: '' }])).toContain("'=evil"); });
});
