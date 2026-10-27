export function detectDelimiter(text) {
  const lines = text.split(/\r\n|\n|\r/).slice(0, 5);
  let best = ',', bestScore = 0;
  for (const d of [',', ';', '\t']) {
    let q = false, n = 0;
    for (const ch of lines[0] ?? '') { if (ch === '"') q = !q; else if (ch === d && !q) n++; }
    if (n > bestScore) { best = d; bestScore = n; }
  }
  return best;
}
export function parseRows(text, d = ',') {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"' && f === '') q = true;
    else if (c === d) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return { rows: rows.filter((r) => !(r.length === 1 && r[0] === '')), unterminated: q };
}
export function parseCsv(input, { delimiter = 'auto', hasHeader = true } = {}) {
  let text = String(input ?? '').replace(/^\uFEFF/, '');
  if (text.trim() === '') return { ok: false, error: 'The file is empty.' };
  if (/\u0000/.test(text)) return { ok: false, error: 'This looks like a binary file, not a text CSV.' };
  const d = delimiter === 'auto' ? detectDelimiter(text) : delimiter;
  const { rows: all, unterminated } = parseRows(text, d);
  if (!all.length) return { ok: false, error: 'No rows could be read from this file.' };
  const warnings = [];
  if (unterminated) warnings.push('A quoted field was never closed; the rest of the file was read as one cell.');
  const width = Math.max(...all.map((r) => r.length));
  const expectedFields = all[0].length;
  const raw = hasHeader ? all[0] : [];
  const seen = new Map(); const headers = [];
  for (let i = 0; i < width; i++) {
    let name = hasHeader ? String(raw[i] ?? '').trim() : '';
    if (!name) { name = `column_${i + 1}`; if (hasHeader && i < raw.length) warnings.push(`Column ${i + 1} has an empty name; renamed to ${name}.`); }
    if (seen.has(name)) { const n = seen.get(name) + 1; seen.set(name, n); warnings.push(`Duplicate column name "${name}"; renamed to "${name}_${n}".`); name = `${name}_${n}`; }
    seen.set(name, seen.get(name) ?? 1); headers.push(name);
  }
  const rows = hasHeader ? all.slice(1) : all;
  return { ok: true, headers, rows, delimiter: d, warnings, expectedFields };
}
