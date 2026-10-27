import { DEFAULT_MISSING, isMissing } from './utils.js';
import { RULES, buildCtx, qualityScore } from './rules.js';
export const CHECK_NAMES = Object.keys(RULES);
export const defaultOptions = () => ({ tokens: [...DEFAULT_MISSING], useTokens: true, ignoreCols: [], highMissingThreshold: 50, checks: Object.fromEntries(CHECK_NAMES.map((k) => [k, true])) });
const RANK = { info: 1, warning: 2, error: 3 };
export function analyze({ headers, rows, expectedFields }, options = {}) {
  const d = defaultOptions();
  const opts = { ...d, ...options, checks: { ...d.checks, ...options.checks }, expectedFields };
  const ctx = buildCtx(headers, rows, opts);
  const findings = [];
  for (const name of CHECK_NAMES) if (opts.checks[name]) findings.push(...RULES[name](ctx));
  findings.forEach((f, i) => { f.id = i + 1; });
  const flagged = new Set(), cellIssues = {};
  for (const f of findings) for (const r of f.rows) {
    for (const c of f.colIndex >= 0 ? [f.colIndex] : headers.map((_, i) => i)) {
      const k = r + ':' + c; flagged.add(k);
      if (!cellIssues[k] || RANK[f.severity] > RANK[cellIssues[k]]) cellIssues[k] = f.severity;
    }
  }
  const columns = headers.map((name, c) => {
    const nonEmpty = rows.length - ctx.missing(c).length;
    const miss = new Set(ctx.missing(c));
    const unique = new Set(rows.map((_, r) => r).filter((r) => !miss.has(r)).map((r) => ctx.cell(r, c).trim())).size;
    return { name, type: ctx.types[c].type, confidence: ctx.types[c].confidence, note: ctx.types[c].note, nonEmpty, missing: ctx.missing(c).length,
      missingPct: rows.length ? Math.round((ctx.missing(c).length / rows.length) * 1000) / 10 : 0, unique, issues: findings.filter((f) => f.colIndex === c).length };
  });
  const count = (s) => findings.filter((f) => f.severity === s).length;
  return { findings, columns, cellIssues, options: opts,
    summary: { rows: rows.length, columns: headers.length, issues: findings.length, errors: count('error'), warnings: count('warning'), infos: count('info'), flaggedCells: flagged.size, score: qualityScore(flagged.size, rows.length, headers.length) } };
}
