import { describe, it, expect } from 'vitest';
import { parseCsv, detectDelimiter } from '../src/js/csv-parser.js';
describe('parseCsv', () => {
  it('rejects empty input', () => { expect(parseCsv('').ok).toBe(false); expect(parseCsv('  \n ').error).toContain('empty'); });
  it('parses headers and rows, stripping BOM', () => {
    const t = parseCsv('\uFEFFa,b\n1,2\n3,4'); expect(t.headers).toEqual(['a', 'b']); expect(t.rows).toEqual([['1', '2'], ['3', '4']]);
  });
  it('works without a header row', () => { const t = parseCsv('1,2\n3,4', { hasHeader: false }); expect(t.headers).toEqual(['column_1', 'column_2']); expect(t.rows).toHaveLength(2); });
  it('handles commas, escaped quotes and multiline fields', () => {
    const t = parseCsv('a,b\n"x, y","say ""hi"""\n"line1\nline2",z\r\n');
    expect(t.rows[0]).toEqual(['x, y', 'say "hi"']); expect(t.rows[1]).toEqual(['line1\nline2', 'z']); expect(t.rows).toHaveLength(2);
  });
  it('detects semicolon and tab delimiters', () => { expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';'); expect(detectDelimiter('a\tb\n1\t2')).toBe('\t'); expect(detectDelimiter('"a;b",c\n')).toBe(','); });
  it('renames duplicate and empty column names', () => { const t = parseCsv('a,a,\n1,2,3'); expect(t.headers).toEqual(['a', 'a_2', 'column_3']); expect(t.warnings).toHaveLength(2); });
  it('keeps uneven rows and widens headers', () => { const t = parseCsv('a,b\n1\n1,2,3'); expect(t.headers).toHaveLength(3); expect(t.expectedFields).toBe(2); });
  it('warns on unterminated quotes', () => { expect(parseCsv('a,b\n"oops,1').warnings).toHaveLength(1); });
  it('handles header-only files', () => { const t = parseCsv('a,b'); expect(t.ok).toBe(true); expect(t.rows).toHaveLength(0); });
});
