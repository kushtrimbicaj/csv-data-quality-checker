import { visible } from './utils.js';
export const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
};
const set = (el, ...kids) => el.replaceChildren(...kids.flat());
export const TYPE_LABELS = { missing: 'Missing values', highMissing: 'High missing rate', duplicates: 'Duplicate rows', whitespace: 'Whitespace', case: 'Inconsistent values', types: 'Mixed types', email: 'Invalid email', constant: 'Constant column', rowLength: 'Row length' };
const badge = (s) => h('span', { class: 'badge ' + s }, s);
export function renderSummary(el, s) {
  const card = (l, v, cls = '') => h('div', { class: 'card ' + cls }, h('span', { class: 'card-label' }, l), h('strong', { class: 'card-value' }, v));
  set(el, card('Rows', s.rows), card('Columns', s.columns), card('Issues', `${s.issues}`, ''),
    card('Quality score', s.score === null ? 'N/A' : s.score + '/100', s.score === null ? '' : s.score >= 90 ? 'good' : s.score >= 70 ? 'mid' : 'bad'),
    h('div', { class: 'card sev' }, h('span', { class: 'card-label' }, 'By severity'), h('span', {}, badge('error'), ' ', s.errors, '  ', badge('warning'), ' ', s.warnings, '  ', badge('info'), ' ', s.infos)));
}
export function renderFindings(el, list, selectedId, onSelect) {
  if (!list.length) return set(el, h('p', { class: 'empty' }, 'No findings match the current filters.'));
  set(el, list.map((f) => h('li', {}, h('button', { class: 'finding' + (f.id === selectedId ? ' selected' : ''), type: 'button', 'aria-pressed': f.id === selectedId, onclick: () => onSelect(f.id) },
    badge(f.severity), h('span', { class: 'f-title' }, TYPE_LABELS[f.type], f.column ? ` · ${f.column}` : ''), h('span', { class: 'f-count' }, f.count)))));
}
export function renderDetail(el, f, onRow) {
  if (!f) return set(el, h('p', { class: 'empty' }, 'Select a finding to see details.'));
  set(el, h('h3', {}, badge(f.severity), ' ', TYPE_LABELS[f.type]), h('p', {}, f.message),
    f.column ? h('p', {}, h('b', {}, 'Column: '), f.column) : '',
    f.rows.length ? h('p', {}, h('b', {}, `Affected rows (${f.rows.length}): `), f.rows.slice(0, 20).map((r) => h('button', { class: 'chip', type: 'button', onclick: () => onRow(r) }, r + 1)), f.rows.length > 20 ? ` … +${f.rows.length - 20} more` : '') : '',
    f.examples.length ? h('div', {}, h('b', {}, 'Examples:'), h('ul', {}, f.examples.map((x) => h('li', {}, h('code', {}, x))))) : '',
    f.suggestion ? h('p', {}, h('b', {}, 'Suggestion: '), f.suggestion) : '', f.warning ? h('p', { class: 'warn' }, '⚠ ' + f.warning) : '');
}
export function renderColumns(el, cols) {
  const head = ['Column', 'Type', 'Non-empty', 'Missing', 'Missing %', 'Unique', 'Issues'];
  set(el, h('thead', {}, h('tr', {}, head.map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, cols.map((c) => h('tr', {}, h('th', { scope: 'row' }, c.name), h('td', { title: c.note || '' }, c.type + (c.note ? ' *' : '')), h('td', {}, c.nonEmpty), h('td', {}, c.missing), h('td', {}, c.missingPct + '%'), h('td', {}, c.unique), h('td', {}, c.issues)))));
}
export function renderPreview(el, table, cellIssues, rowIdx, page, size, onCell) {
  const slice = rowIdx.slice(page * size, page * size + size);
  set(el, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, '#'), table.headers.map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, slice.map((r) => h('tr', { id: 'row-' + (r + 1) }, h('th', { scope: 'row' }, r + 1), table.headers.map((_, c) => {
      const v = String(table.rows[r][c] ?? ''), sev = cellIssues[r + ':' + c];
      return h('td', { class: sev ? 'cell-' + sev : '', tabindex: 0, title: sev ? `${sev}: click to inspect` : 'Click to inspect',
        onclick: () => onCell(r, c, v), onkeydown: (e) => { if (e.key === 'Enter') onCell(r, c, v); } }, v);
    })))));
  return Math.max(1, Math.ceil(rowIdx.length / size));
}
export const inspectText = (name, r, v) => `Row ${r + 1}, "${name}" (${v.length} chars)\n${visible(v)}`;
