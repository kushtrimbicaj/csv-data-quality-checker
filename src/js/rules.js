import { isMissing, pct } from './utils.js';
export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
export const isEmail = (v) => v.length <= 254 && EMAIL_RE.test(v);
const dateOk = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(y, m, 0).getDate();
function isDate(s) {
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/);
  if (m) return dateOk(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return !!m && (dateOk(+m[3], +m[2], +m[1]) || dateOk(+m[3], +m[1], +m[2]));
}
export function classify(v) {
  const s = String(v).trim();
  if (/^(true|false|yes|no)$/i.test(s)) return 'boolean';
  if (/^0\d+$/.test(s)) return 'text'; // leading zeros: identifier
  if (/^[+-]?\d+$/.test(s)) return 'integer';
  if (/^[+-]?(\d+\.\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) || /^[+-]?\d+[eE][+-]?\d+$/.test(s)) return 'decimal';
  if (isDate(s)) return 'date';
  if (isEmail(s)) return 'email';
  return 'text';
}
const norm = (t) => (t === 'integer' ? 'decimal' : t);
export function inferType(values, header = '') {
  const c = {};
  for (const v of values) { const t = classify(v); c[t] = (c[t] || 0) + 1; }
  const total = values.length;
  if (!total) return { type: 'empty', confidence: 1, counts: c, note: 'No non-missing values to infer from.' };
  const idLike = /(^|[\s_-])(id|zip|postal|postcode|code|phone|sku)([\s_-]|$)/i.test(header);
  if (idLike && values.every((v) => /^\d+$/.test(v))) return { type: 'text', confidence: 1, counts: c, note: 'Digit-only values in an identifier-like column are treated as text.' };
  const hasInt = c.integer, hasDec = c.decimal;
  if (hasInt && hasDec) { c.decimal += c.integer; delete c.integer; }
  const [top, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  const confidence = n / total;
  let type = confidence >= 0.9 ? top : 'mixed', note = '';
  if (/e-?mail/i.test(header) && (c.email || 0) / total >= 0.5) type = 'email';
  else if (type === 'integer' && /(^|[\s_-])(id|zip|postal|postcode|code|phone|sku)([\s_-]|$)/i.test(header)) { type = 'text'; note = 'Numeric-looking values in an identifier-like column are treated as text.'; }
  if (type === 'mixed') note = 'No single type covers 90% of values.';
  else if (confidence < 1 && !note) note = `Classification is uncertain: ${Math.round(confidence * 100)}% of values match.`;
  return { type, confidence, counts: c, note };
}
export function buildCtx(headers, rows, opts) {
  const ctx = { headers, rows, opts, cache: {} };
  ctx.cell = (r, c) => String(rows[r][c] ?? '');
  ctx.missing = (c) => (ctx.cache['m' + c] ??= rows.map((_, r) => r).filter((r) => isMissing(ctx.cell(r, c), opts.tokens, opts.useTokens)));
  ctx.types = headers.map((h, c) => {
    const miss = new Set(ctx.missing(c));
    const vals = []; for (let r = 0; r < rows.length; r++) if (!miss.has(r)) vals.push(ctx.cell(r, c).trim());
    return inferType(vals, h);
  });
  return ctx;
}
const mk = (ctx, type, severity, ci, rows, message, extra = {}) => ({
  type, severity, column: ci == null ? null : ctx.headers[ci], colIndex: ci ?? -1, rows, count: rows.length,
  message, examples: [], suggestion: '', warning: '', ...extra,
});
const eachCol = (ctx, fn) => ctx.headers.flatMap((_, c) => fn(c) || []);
const label = (v) => (String(v).trim() === '' ? '(empty)' : String(v));
export const RULES = {
  missing: (ctx) => eachCol(ctx, (c) => {
    const rows = ctx.missing(c); if (!rows.length) return;
    return mk(ctx, 'missing', 'warning', c, rows, `${rows.length} of ${ctx.rows.length} values (${pct(rows.length, ctx.rows.length)}%) are missing.`,
      { examples: [...new Set(rows.map((r) => label(ctx.cell(r, c))))].slice(0, 5), pct: pct(rows.length, ctx.rows.length) });
  }),
  highMissing: (ctx) => eachCol(ctx, (c) => {
    const n = ctx.missing(c).length, p = pct(n, ctx.rows.length);
    if (ctx.rows.length && p >= ctx.opts.highMissingThreshold)
      return mk(ctx, 'highMissing', 'error', c, [], `Column is ${p}% missing (threshold ${ctx.opts.highMissingThreshold}%).`, { count: n, suggestion: 'Consider whether this column is usable or should be dropped.' });
  }),
  duplicates(ctx) {
    const idx = ctx.headers.map((_, i) => i).filter((i) => !ctx.opts.ignoreCols.includes(ctx.headers[i]));
    const first = new Map(), dups = [], pairs = [];
    ctx.rows.forEach((row, r) => {
      const key = JSON.stringify(idx.map((i) => String(row[i] ?? '')));
      if (first.has(key)) { dups.push(r); pairs.push(`row ${r + 1} duplicates row ${first.get(key) + 1}`); } else first.set(key, r);
    });
    if (!dups.length) return [];
    return [mk(ctx, 'duplicates', 'warning', null, dups, `${dups.length} duplicate row(s) found; first occurrences are not counted.`,
      { examples: pairs.slice(0, 5), suggestion: 'Review before removing; the tool never deletes rows.', warning: idx.length < ctx.headers.length ? 'Ignored columns were excluded from comparison.' : '' })];
  },
  whitespace: (ctx) => eachCol(ctx, (c) => {
    const rows = ctx.rows.map((_, r) => r).filter((r) => ctx.cell(r, c) !== ctx.cell(r, c).trim());
    if (!rows.length) return;
    return mk(ctx, 'whitespace', 'warning', c, rows, `${rows.length} value(s) have leading or trailing whitespace.`,
      { examples: rows.slice(0, 5).map((r) => JSON.stringify(ctx.cell(r, c))), suggestion: 'Trim surrounding whitespace.' });
  }),
  case: (ctx) => eachCol(ctx, (c) => {
    if (ctx.types[c].type !== 'text') return;
    const groups = new Map();
    ctx.rows.forEach((_, r) => {
      const t = ctx.cell(r, c).trim(); if (!t || isMissing(t, ctx.opts.tokens, ctx.opts.useTokens)) return;
      const k = t.toLowerCase().replace(/\s+/g, ' ');
      const g = groups.get(k) ?? new Map(); g.set(t, (g.get(t) ?? 0) + 1); groups.set(k, g);
    });
    const bad = [...groups.values()].filter((g) => g.size > 1);
    if (!bad.length) return;
    const normalize = {}; const variants = new Set();
    for (const g of bad) { const top = [...g.entries()].sort((a, b) => b[1] - a[1])[0][0]; for (const v of g.keys()) { variants.add(v); normalize[v] = top; } }
    const rows = ctx.rows.map((_, r) => r).filter((r) => variants.has(ctx.cell(r, c).trim()));
    return mk(ctx, 'case', 'warning', c, rows, `${bad.length} group(s) of values differ only by capitalization or spacing. These are potential inconsistencies, not confirmed duplicates.`,
      { examples: bad.slice(0, 5).map((g) => [...g.keys()].join(' / ')), normalize, suggestion: 'Suggested canonical forms: ' + bad.slice(0, 3).map((g) => normalize[[...g.keys()][0]]).join(', '), warning: 'Different capitalization may be intentional (e.g. codes, names).' });
  }),
  types: (ctx) => eachCol(ctx, (c) => {
    const t = ctx.types[c]; if (['text', 'empty', 'email'].includes(t.type)) return;
    const rows = []; const ex = [];
    ctx.rows.forEach((_, r) => {
      if (ctx.missing(c).includes(r)) return;
      const v = ctx.cell(r, c).trim(); const k = norm(classify(v));
      if (t.type !== 'mixed' && k !== norm(t.type)) { rows.push(r); ex.push(`${v} (${classify(v)})`); }
    });
    if (t.type === 'mixed') return mk(ctx, 'types', 'warning', c, [], `Mixed types: ${Object.entries(t.counts).map(([k, n]) => `${k} ${n}`).join(', ')}.`, { count: Object.values(t.counts).reduce((a, b) => a + b, 0), suggestion: t.note });
    if (rows.length) return mk(ctx, 'types', 'warning', c, rows, `Column looks like ${t.type}, but ${rows.length} value(s) do not match.`, { examples: [...new Set(ex)].slice(0, 5), suggestion: 'Check these values manually.', warning: t.note });
  }),
  email: (ctx) => eachCol(ctx, (c) => {
    const t = ctx.types[c]; if (t.type !== 'email') return;
    const rows = ctx.rows.map((_, r) => r).filter((r) => !ctx.missing(c).includes(r) && !isEmail(ctx.cell(r, c).trim()));
    if (!rows.length) return;
    return mk(ctx, 'email', 'error', c, rows, `${rows.length} value(s) do not look like valid email addresses. (Format check only; mailbox existence is not verified.)`,
      { examples: [...new Set(rows.map((r) => ctx.cell(r, c)))].slice(0, 5) });
  }),
  constant: (ctx) => eachCol(ctx, (c) => {
    const vals = ctx.rows.map((_, r) => r).filter((r) => !ctx.missing(c).includes(r)).map((r) => ctx.cell(r, c));
    if (vals.length > 1 && new Set(vals).size === 1) return mk(ctx, 'constant', 'info', c, [], `Every non-missing value is identical (${JSON.stringify(vals[0])}).`, { count: vals.length, suggestion: 'A constant column carries no information.' });
  }),
  rowLength(ctx) {
    const n = ctx.opts.expectedFields ?? ctx.headers.length;
    const rows = ctx.rows.map((r, i) => i).filter((r) => ctx.rows[r].length !== n);
    if (!rows.length) return [];
    return [mk(ctx, 'rowLength', 'error', null, rows, `${rows.length} row(s) do not have ${n} fields.`, { examples: rows.slice(0, 5).map((r) => `row ${r + 1}: ${ctx.rows[r].length} fields`) })];
  },
};
/** Score = 100 × (1 − flaggedCells / totalCells). A cell is flagged once, whatever the number or severity of findings on it. */
export function qualityScore(flagged, rows, cols) {
  if (!rows || !cols) return null;
  return Math.round(100 * (1 - Math.min(flagged, rows * cols) / (rows * cols)));
}
