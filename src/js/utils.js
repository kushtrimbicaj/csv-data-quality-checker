export const DEFAULT_MISSING = ['N/A', 'NA', 'NULL', 'null', '-'];
export const isMissing = (v, tokens = [], useTokens = true) => {
  const s = String(v ?? '').trim();
  return s === '' || (useTokens && tokens.includes(s));
};
const NUMERIC = /^[+-]?\d+(\.\d+)?$/;
/** Prefix values that spreadsheets could run as formulas (plain numbers are exempt). */
export function protectFormula(v) {
  const s = String(v ?? '');
  return /^[=+\-@\t\r]/.test(s) && !NUMERIC.test(s) ? "'" + s : s;
}
export function escapeField(v, { protect = true } = {}) {
  const s = protect ? protectFormula(v) : String(v ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export const toCsv = (rows, opts) => rows.map((r) => r.map((c) => escapeField(c, opts)).join(',')).join('\r\n');
export const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
export const formatBytes = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
export const visible = (s) => JSON.stringify(String(s ?? ''));
