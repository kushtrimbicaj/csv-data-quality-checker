import { parseCsv } from './csv-parser.js';
import { analyze, CHECK_NAMES, defaultOptions } from './analyzer.js';
import { formatBytes } from './utils.js';
import * as R from './renderer.js';
import { reportJson, findingsCsv, cleanedCsv, planCleaning, download } from './exporter.js';
const $ = (id) => document.getElementById(id);
const MAX_BYTES = 25 * 1024 * 1024, PAGE = 50;
const SAMPLE = 'id,name,email,country,age,zip\n1,Arben Gashi,arben@example.com,Kosovo,34,10000\n2,Dritë Krasniqi,drite@example,kosovo,29,10000\n3,Besa Hoxha,besa@example.com,KOSOVO ,N/A,20000\n4,Liridon Berisha,liridon@example.com,Albania,41,00123\n4,Liridon Berisha,liridon@example.com,Albania,41,00123\n5,Elira Morina,,Albania,abc,00456\n6,Gent Rama,gent@example.com,Kosovo,38,10000,extra\n';
const st = { text: '', file: null, table: null, result: null, sel: null, page: 0, filters: { severity: '', type: '', column: '', row: '' }, search: '' };
const status = (msg, kind = '') => { const e = $('status'); e.textContent = msg; e.className = 'status ' + kind; };

// theme
const applyTheme = (t) => { document.documentElement.dataset.theme = t; $('themeToggle').setAttribute('aria-pressed', t === 'dark'); $('themeToggle').textContent = t === 'dark' ? '☀ Light' : '☾ Dark'; };
let saved = null; try { saved = localStorage.getItem('theme'); } catch { /* storage unavailable */ }
applyTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('themeToggle').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(t); try { localStorage.setItem('theme', t); } catch { /* ignore */ } };

// settings
$('checks').replaceChildren(...CHECK_NAMES.map((k) => R.h('label', { class: 'check' }, R.h('input', { type: 'checkbox', 'data-check': k, checked: true }), R.TYPE_LABELS[k])));
$('tokens').value = defaultOptions().tokens.join(', ');
const readOptions = () => ({
  tokens: $('tokens').value.split(',').map((s) => s.trim()).filter(Boolean), useTokens: $('useTokens').checked,
  ignoreCols: [...$('ignoreCols').selectedOptions].map((o) => o.value), highMissingThreshold: Math.min(100, Math.max(1, +$('threshold').value || 50)),
  checks: Object.fromEntries([...document.querySelectorAll('[data-check]')].map((i) => [i.dataset.check, i.checked])) });

function loadText(name, size, text) {
  const t = parseCsv(text, { delimiter: $('delimiter').value, hasHeader: $('hasHeader').checked });
  if (!t.ok) { status(t.error, 'error'); return; }
  st.file = { name, size }; st.text = text; st.table = t; st.page = 0; st.sel = null;
  $('ignoreCols').replaceChildren(...t.headers.map((n) => R.h('option', { value: n }, n)));
  $('fileInfo').textContent = `${name} · ${formatBytes(size)} · ${t.rows.length} rows × ${t.headers.length} columns · delimiter ${t.delimiter === '\t' ? 'tab' : `"${t.delimiter}"`}`;
  $('upload').hidden = true; $('workspace').hidden = false;
  status(t.warnings.length ? 'Loaded with notes: ' + t.warnings.join(' ') : 'File loaded and analysed locally.', t.warnings.length ? 'warn' : 'ok');
  run();
}
function run() {
  if (!st.table) return;
  status('Analysing…');
  setTimeout(() => { try { st.result = analyze(st.table, readOptions()); } catch (e) { status('Analysis failed: ' + e.message, 'error'); return; } status('Analysis complete.', 'ok'); refresh(); }, 0);
}
const visibleFindings = () => st.result.findings.filter((f) => (!st.filters.severity || f.severity === st.filters.severity) && (!st.filters.type || f.type === st.filters.type)
  && (!st.filters.column || f.column === st.filters.column) && (!st.filters.row || f.rows.includes(+st.filters.row - 1)));
function previewRows() {
  const q = st.search.toLowerCase(); const out = [];
  st.table.rows.forEach((row, r) => { if (!q || row.some((c) => String(c).toLowerCase().includes(q))) out.push(r); });
  return out;
}
function refresh() {
  const { result: res, table } = st;
  R.renderSummary($('summary'), res.summary);
  $('typeFilter').replaceChildren(R.h('option', { value: '' }, 'All types'), ...Object.entries(R.TYPE_LABELS).map(([k, v]) => R.h('option', { value: k }, v)));
  $('colFilter').replaceChildren(R.h('option', { value: '' }, 'All columns'), ...table.headers.map((n) => R.h('option', { value: n }, n)));
  $('typeFilter').value = st.filters.type; $('colFilter').value = st.filters.column;
  drawFindings(); R.renderColumns($('columns'), res.columns); drawPreview(); drawClean();
}
function drawFindings() {
  R.renderFindings($('findings'), visibleFindings(), st.sel, (id) => { st.sel = id; drawFindings(); });
  R.renderDetail($('detail'), st.result.findings.find((f) => f.id === st.sel), gotoRow);
}
function drawPreview() {
  const rows = previewRows();
  const pages = R.renderPreview($('preview'), st.table, st.result.cellIssues, rows, st.page = Math.min(st.page, Math.max(0, Math.ceil(rows.length / PAGE) - 1)), PAGE,
    (r, c, v) => { $('inspector').textContent = R.inspectText(st.table.headers[c], r, v); });
  $('pageInfo').textContent = `Page ${st.page + 1} of ${pages} · ${rows.length} rows`;
  $('prev').disabled = st.page === 0; $('next').disabled = st.page >= pages - 1;
}
function gotoRow(r) {
  st.search = ''; $('search').value = ''; st.page = Math.floor(r / PAGE); drawPreview();
  const tr = document.getElementById('row-' + (r + 1)); if (tr) { tr.scrollIntoView({ block: 'center' }); tr.classList.add('flash'); }
}
function drawClean() {
  const { changes } = planCleaning(st.table, st.result, { trim: $('optTrim').checked, normalizeCase: $('optCase').checked });
  $('cleanPreview').textContent = !$('optTrim').checked && !$('optCase').checked ? 'No transformations selected: the cleaned file would be identical to the original.'
    : `${changes.length} cell(s) would change.` + changes.slice(0, 5).map((c) => `\n  row ${c.row}, ${c.column}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`).join('');
}
function reset() { st.table = st.result = st.file = null; $('workspace').hidden = true; $('upload').hidden = false; $('fileInput').value = ''; status('Ready. Choose or drop a CSV file.'); }

// file input / drag-and-drop
async function handleFile(file) {
  if (!file) return;
  if (!/\.(csv|tsv|txt)$/i.test(file.name) && file.type && !file.type.includes('csv') && !file.type.includes('text')) return status('Unsupported file type. Please choose a .csv file.', 'error');
  if (file.size === 0) return status('The file is empty.', 'error');
  if (file.size > MAX_BYTES) return status(`File is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_BYTES)} to keep the browser responsive.`, 'error');
  status('Reading file…');
  try { loadText(file.name, file.size, await file.text()); } catch (e) { status('Could not read the file: ' + e.message, 'error'); }
}
const drop = $('dropzone');
$('browse').onclick = () => $('fileInput').click();
$('fileInput').onchange = (e) => handleFile(e.target.files[0]);
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); handleFile(e.dataTransfer.files[0]); });
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileInput').click(); } });
$('sample').onclick = () => loadText('sample.csv', SAMPLE.length, SAMPLE);
$('remove').onclick = reset;
for (const id of ['hasHeader', 'delimiter']) $(id).onchange = () => { if (st.file) { const f = st.file; loadText(f.name, f.size, st.text ?? ''); } };

$('rerun').onclick = run;
$('resetSettings').onclick = () => { $('tokens').value = defaultOptions().tokens.join(', '); $('useTokens').checked = true; $('threshold').value = 50; document.querySelectorAll('[data-check]').forEach((i) => { i.checked = true; }); [...$('ignoreCols').options].forEach((o) => { o.selected = false; }); run(); };
$('sevFilter').onchange = (e) => { st.filters.severity = e.target.value; drawFindings(); };
$('typeFilter').onchange = (e) => { st.filters.type = e.target.value; drawFindings(); };
$('colFilter').onchange = (e) => { st.filters.column = e.target.value; drawFindings(); };
$('rowFilter').oninput = (e) => { st.filters.row = e.target.value; drawFindings(); };
$('search').oninput = (e) => { st.search = e.target.value; st.page = 0; drawPreview(); };
$('gotoRow').onchange = (e) => { const n = +e.target.value; if (n >= 1 && n <= st.table.rows.length) gotoRow(n - 1); };
$('prev').onclick = () => { st.page--; drawPreview(); };
$('next').onclick = () => { st.page++; drawPreview(); };
$('optTrim').onchange = $('optCase').onchange = () => drawClean();
const meta = () => ({ name: st.file.name, size: st.file.size, rows: st.table.rows.length, columns: st.table.headers.length });
$('expJson').onclick = () => download('quality-report.json', reportJson(st.result, meta()), 'application/json');
$('expFindings').onclick = () => download('findings.csv', findingsCsv(st.result.findings), 'text/csv');
$('expClean').onclick = () => download('cleaned.csv', cleanedCsv(st.table, st.result, { trim: $('optTrim').checked, normalizeCase: $('optCase').checked }), 'text/csv');
