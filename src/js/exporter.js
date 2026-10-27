import { toCsv } from './utils.js';
export const reportJson = (result, meta = {}) => JSON.stringify({ generatedAt: new Date().toISOString(), file: meta, summary: result.summary, columns: result.columns,
  findings: result.findings.map((f) => ({ id: f.id, type: f.type, severity: f.severity, column: f.column, count: f.count, rows: f.rows.map((r) => r + 1), message: f.message, examples: f.examples, suggestion: f.suggestion })) }, null, 2);
export const findingsCsv = (findings) => toCsv([['id', 'severity', 'type', 'column', 'count', 'affected_rows', 'message', 'suggestion'],
  ...findings.map((f) => [f.id, f.severity, f.type, f.column ?? '', f.count, f.rows.slice(0, 100).map((r) => r + 1).join(';'), f.message, f.suggestion])]);
/** Applies ONLY the explicitly selected transformations to a copy of the data. */
export function planCleaning(table, result, { trim = false, normalizeCase = false } = {}) {
  const maps = {}; if (normalizeCase) for (const f of result.findings) if (f.type === 'case') maps[f.colIndex] = f.normalize;
  const changes = [];
  const rows = table.rows.map((row, r) => row.map((v, c) => {
    let out = v; if (trim) out = out.trim();
    if (maps[c]) { const t = out.trim(); if (maps[c][t] !== undefined) out = out.replace(t, maps[c][t]); }
    if (out !== v) changes.push({ row: r + 1, column: table.headers[c], from: v, to: out });
    return out;
  }));
  return { rows, changes };
}
export const cleanedCsv = (table, result, opts) => toCsv([table.headers, ...planCleaning(table, result, opts).rows]);
export function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
