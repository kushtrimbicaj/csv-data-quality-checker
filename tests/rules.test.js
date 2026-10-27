import { describe, it, expect } from 'vitest';
import { isEmail, classify, inferType, qualityScore } from '../src/js/rules.js';
import { toCsv, escapeField, protectFormula, isMissing } from '../src/js/utils.js';
describe('rules helpers', () => {
  it('validates emails practically', () => { expect(isEmail('a@b.co')).toBe(true); expect(isEmail('a+tag@x.example.org')).toBe(true); expect(isEmail('a@b')).toBe(false); expect(isEmail('a b@c.com')).toBe(false); expect(isEmail('@c.com')).toBe(false); });
  it('classifies values', () => { expect(classify('12')).toBe('integer'); expect(classify('1.5')).toBe('decimal'); expect(classify('2024-02-30')).toBe('text'); expect(classify('2024-02-29')).toBe('date'); expect(classify('yes')).toBe('boolean'); expect(classify('00123')).toBe('text'); });
  it('flags mixed columns and treats int+decimal as decimal', () => {
    expect(inferType(['1', '2.5', '3']).type).toBe('decimal'); expect(inferType(['1', 'x', '2', 'y']).type).toBe('mixed'); expect(inferType(['1', '2', '3']).type).toBe('integer');
  });
  it('keeps identifier columns as text', () => { expect(inferType(['10000', '20000'], 'zip_code').type).toBe('text'); });
  it('missing tokens are configurable', () => { expect(isMissing('N/A', ['N/A'])).toBe(true); expect(isMissing('N/A', ['N/A'], false)).toBe(false); expect(isMissing('  ')).toBe(true); });
  it('quality score is deterministic and N/A for empty data', () => { expect(qualityScore(0, 10, 2)).toBe(100); expect(qualityScore(10, 10, 2)).toBe(50); expect(qualityScore(0, 0, 3)).toBeNull(); expect(qualityScore(0, 3, 0)).toBeNull(); });
  it('escapes CSV fields', () => { expect(escapeField('a,b')).toBe('"a,b"'); expect(escapeField('say "x"')).toBe('"say ""x"""'); expect(toCsv([['a', 'b\nc']])).toBe('a,"b\nc"'); });
  it('protects against formula injection but not plain numbers', () => {
    for (const v of ['=1+1', '+cmd', '-cmd', '@SUM(A1)']) expect(protectFormula(v)).toBe("'" + v);
    expect(protectFormula('-5')).toBe('-5'); expect(protectFormula('00123')).toBe('00123');
  });
});
describe('identifier columns', () => {
  it('treats digit-only zip values (with leading zeros) as text', () => { expect(inferType(['10000', '00123', '20000'], 'zip').type).toBe('text'); });
});
