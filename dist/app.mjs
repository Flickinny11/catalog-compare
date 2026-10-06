import { parseCSV, compareTables, reportCSV } from './core.mjs?v=b4020657d8a1';
const $ = id => document.getElementById(id);
const state = { before: null, after: null, result: null, filter: 'all', query: '', page: 0, example: false };
const generations = { before: 0, after: 0 };
const labels = { changed: 'Changed', unchanged: 'Unchanged', added: 'Supplier only', removed: 'Catalog only', conflict: 'Duplicate SKU', invalid: 'Needs review' };
const exampleBefore = 'SKU,Product,Price\r\n000124,Canvas tote,18.00\r\n000125,Desk tray,24.50\r\n000126,Glass carafe,32.00\r\n000127,Linen cover,29.00\r\n000128,Wall hook,0.00\r\n000129,Notebook,8.50\r\n000130,Storage jar,14.00\r\nDUP-10,Candle small,12.00\r\nDUP-10,Candle large,18.00\r\n000131,Shelf bracket,22.00\r\n';
const exampleAfter = 'Item code,Description,New price\r\n000124,Canvas tote,21.00\r\n000125,Desk tray,24.50\r\n000126,Glass carafe,30.00\r\n000127,Linen cover,\r\n000128,Wall hook,6.00\r\n000129,Notebook,9.00\r\nDUP-10,Candle,15.00\r\n000131,Shelf bracket,22.00\r\nNEW-22,Oak peg,7.50\r\n';
function textNode(tag, text, className) { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; }
function populate(side) {
  const data = state[side];
  for (const field of ['key', 'value']) { const select = $(`${side}-${field}`); select.replaceChildren(); data.table.headers.forEach((h, i) => { const option = new Option(h, String(i)); select.add(option); }); select.disabled = false; }
  const headers = data.table.headers;
  const key = headers.findIndex(h => /^(variant\s*sku|sku|item\s*code|code|item)$/i.test(h.trim()));
  const value = headers.findIndex(h => /price|cost|amount|value/i.test(h));
  $(`${side}-key`).value = String(key >= 0 ? key : 0);
  $(`${side}-value`).value = String(value >= 0 && value !== (key >= 0 ? key : 0) ? value : 1);
  $(`${side}-name`).textContent = data.name; $(`${side}-detail`).textContent = `${data.table.rows.length.toLocaleString()} rows / ${headers.length} columns`;
  $(`${side}-error`).textContent = '';
  $('compare-button').disabled = !(state.before?.table && state.after?.table);
}
function invalidate() {
  state.result = null; $('download-button').disabled = true; $('view-report-button').disabled = true; $('report-output').value = ''; if ($('report-dialog').open) $('report-dialog').close(); $('summary').hidden = true; $('review-tools').hidden = true; $('pagination').hidden = true;
  $('review-subtitle').textContent = 'Files or settings changed. Compare again to refresh the review.';
  $('table-area').replaceChildren(textNode('p', 'Ready when you are. Confirm both column mappings, then compare files.', 'no-matches'));
}
function readText(side, text, name) {
  const delimiter = $(`${side}-delimiter`).value === 'tab' ? '\t' : $(`${side}-delimiter`).value;
  try { const table = parseCSV(text, delimiter); state[side] = { text, name, table }; populate(side); invalidate(); }
  catch (error) { state[side] = { text, name, table: null }; $(`${side}-name`).textContent = name; $(`${side}-detail`).textContent = 'File needs attention'; $(`${side}-error`).textContent = error.message; for (const field of ['key', 'value']) $(`${side}-${field}`).disabled = true; $('compare-button').disabled = true; invalidate(); }
}
async function loadFile(side, file) {
  if (!file) return;
  const generation = ++generations[side];
  state.example = false; $('example-label').hidden = true;
  state[side] = null; invalidate(); $('compare-button').disabled = true;
  $(`${side}-name`).textContent = file.name; $(`${side}-detail`).textContent = 'Reading file…'; $(`${side}-error`).textContent = '';
  for (const field of ['key', 'value']) { $(`${side}-${field}`).disabled = true; $(`${side}-${field}`).replaceChildren(new Option('Choose a valid file', '')); }
  if (file.size > 5000000) { $(`${side}-detail`).textContent = 'File needs attention'; $(`${side}-error`).textContent = 'Choose a CSV smaller than 5 MB.'; return; }
  try { const bytes = await file.arrayBuffer(); if (generation !== generations[side]) return; const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); readText(side, text, file.name); }
  catch { if (generation !== generations[side]) return; $(`${side}-detail`).textContent = 'File needs attention'; $(`${side}-error`).textContent = 'This file could not be read as UTF-8. Export a UTF-8 CSV and try again.'; }
}
function compare() {
  $('app-error').hidden = true;
  try {
    if (!state.before?.table || !state.after?.table) throw new Error('Choose two valid CSV files first.');
    state.result = compareTables(state.before.table, state.after.table, { beforeKey: +$('before-key').value, beforeValue: +$('before-value').value, afterKey: +$('after-key').value, afterValue: +$('after-value').value, beforeDecimal: $('before-decimal').value, afterDecimal: $('after-decimal').value, trimKeys: $('trim-keys').checked });
    state.page = 0; state.filter = 'all'; state.query = ''; $('search').value = ''; render();
  } catch (error) { $('app-error').textContent = error.message; $('app-error').hidden = false; }
}
function render() {
  const result = state.result; if (!result) return;
  const c = result.counts; $('summary').hidden = false; $('review-tools').hidden = false; $('download-button').disabled = false; $('view-report-button').disabled = false;
  $('example-label').hidden = !state.example;
  $('review-subtitle').textContent = `${result.sourceCounts.before.toLocaleString()} catalog rows compared with ${result.sourceCounts.after.toLocaleString()} supplier rows. ${$('trim-keys').checked ? 'Edge spaces trimmed.' : 'SKUs matched exactly.'}`;
  $('summary').replaceChildren(...[[c.changed, 'Changed values', ''], [c.conflict + c.invalid, 'Exceptions to inspect', 'exception'], [c.added + c.removed, 'Unmatched SKUs', '']].map(([n, label, cls]) => { const el = textNode('div', '', 'summary-item ' + cls); el.append(textNode('strong', n), textNode('span', label)); return el; }));
  const filters = [['all', 'All', result.rows.length], ['changed', 'Changes', c.changed], ['exceptions', 'Exceptions', c.conflict + c.invalid], ['unmatched', 'Unmatched', c.added + c.removed], ['unchanged', 'Unchanged', c.unchanged]];
  $('filters').replaceChildren(...filters.map(([id, label, n]) => { const b = textNode('button', `${label} ${n}`); b.setAttribute('aria-pressed', String(state.filter === id)); b.onclick = () => { state.filter = id; state.page = 0; render(); }; return b; }));
  const rows = result.rows.filter(r => (state.filter === 'all' || r.status === state.filter || state.filter === 'exceptions' && ['conflict', 'invalid'].includes(r.status) || state.filter === 'unmatched' && ['added', 'removed'].includes(r.status)) && r.key.toLowerCase().includes(state.query.toLowerCase()));
  const pageSize = 50, pageCount = Math.max(1, Math.ceil(rows.length / pageSize)); state.page = Math.min(state.page, pageCount - 1);
  const table = document.createElement('table'); const thead = document.createElement('thead'); const tr = document.createElement('tr');
  ['SKU', 'Catalog value', 'Supplier value', 'Change', 'Review'].forEach((h, i) => { const th = textNode('th', h, i > 0 && i < 4 ? 'numeric' : ''); th.scope = 'col'; tr.append(th); }); thead.append(tr); table.append(thead);
  const tbody = document.createElement('tbody');
  for (const row of rows.slice(state.page * pageSize, (state.page + 1) * pageSize)) {
    const tr = document.createElement('tr'); const sku = textNode('td', row.key.trim() ? row.key : '(blank SKU)', 'sku');
    sku.append(textNode('small', `${row.before.length ? 'Catalog ' + row.before.map(v => v.record).join(', ') : ''}${row.before.length && row.after.length ? ' / ' : ''}${row.after.length ? 'Supplier ' + row.after.map(v => v.record).join(', ') : ''}`)); tr.append(sku);
    for (const side of ['before', 'after']) tr.append(textNode('td', row[side].length ? row[side].map(v => v.rawValue.trim() ? v.rawValue : '(blank)').join(' / ') : 'Not supplied', 'numeric'));
    tr.append(textNode('td', row.delta || '—', 'numeric')); const review = document.createElement('td'); const tag = textNode('span', labels[row.status], 'tag ' + row.status); review.append(tag, textNode('small', row.reason)); tr.append(review); tbody.append(tr);
  }
  table.append(tbody); $('table-area').replaceChildren(rows.length ? table : textNode('p', 'No rows match this filter. Try another filter or clear your search.', 'no-matches'));
  const pagination = $('pagination'); pagination.hidden = false; pagination.replaceChildren(textNode('span', rows.length ? `${state.page * pageSize + 1}–${Math.min((state.page + 1) * pageSize, rows.length)} of ${rows.length.toLocaleString()} rows` : '0 rows'));
  const buttons = document.createElement('div'); for (const [label, offset, disabled] of [['Previous', -1, state.page === 0], ['Next', 1, state.page === pageCount - 1]]) { const b = textNode('button', label); b.disabled = disabled; b.onclick = () => { state.page += offset; render(); }; buttons.append(b); } pagination.append(buttons);
}
function example() { for (const s of ['before', 'after']) { generations[s]++; $(`${s}-delimiter`).value = ','; $(`${s}-decimal`).value = '.'; $(`${s}-file`).value = ''; } $('trim-keys').checked = false; readText('before', exampleBefore, 'Example catalog.csv'); readText('after', exampleAfter, 'Example supplier.csv'); state.example = true; compare(); }
for (const side of ['before', 'after']) {
  $(`${side}-file`).addEventListener('change', e => loadFile(side, e.target.files[0]));
  $(`${side}-delimiter`).addEventListener('change', () => { if (state[side]) readText(side, state[side].text, state[side].name); });
  for (const field of ['key', 'value', 'decimal']) $(`${side}-${field}`).addEventListener('change', invalidate);
  const drop = $(`${side}-file`).parentElement;
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragging'); }); drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragging'); loadFile(side, e.dataTransfer.files[0]); });
}
$('trim-keys').addEventListener('change', invalidate); $('compare-button').onclick = compare; $('example-button').onclick = example; $('empty-example').onclick = example;
$('search').addEventListener('input', e => { state.query = e.target.value; state.page = 0; render(); });
$('download-button').onclick = () => { if (!state.result) return; const url = URL.createObjectURL(new Blob([reportCSV(state.result)], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'catalog-change-review.csv'; a.hidden = true; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); };
$('reset-button').onclick = () => { state.before = null; state.after = null; state.result = null; state.example = false; for (const side of ['before', 'after']) { generations[side]++; $(`${side}-file`).value = ''; $(`${side}-name`).textContent = 'Choose a CSV'; $(`${side}-detail`).textContent = side === 'before' ? 'A fresh export of your catalog' : 'The new values you want to review'; $(`${side}-error`).textContent = ''; for (const field of ['key', 'value']) { const select = $(`${side}-${field}`); select.replaceChildren(new Option('Choose a file first', '')); select.disabled = true; } } $('example-label').hidden = true; $('app-error').hidden = true; $('compare-button').disabled = true; invalidate(); $('review-subtitle').textContent = 'Files cleared. Choose two CSVs or try the example.'; };
$('view-report-button').onclick = () => { if (!state.result) return; $('report-output').value = reportCSV(state.result); $('report-dialog').showModal(); };
$('close-report').onclick = () => $('report-dialog').close();
$('select-report').onclick = () => { $('report-output').focus(); $('report-output').select(); };
$('about-button').onclick = () => $('about').showModal(); $('close-about').onclick = $('done-about').onclick = () => $('about').close();

if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const tools = [
    { name: 'load_comparison_example', title: 'Load the synthetic comparison', description: 'Replace the currently selected files and results with the built-in synthetic catalog example, then compare it in the visible interface.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input) { if (!input || Object.keys(input).length) throw new Error('This action accepts an empty object.'); example(); return { synthetic: true, counts: { ...state.result.counts } }; } },
    { name: 'get_comparison_summary', title: 'Read comparison counts', description: 'Read the current comparison counts and selected filter. Returns no source rows or file contents.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute(input) { if (!input || Object.keys(input).length) throw new Error('This action accepts an empty object.'); return state.result ? { ready: true, synthetic: state.example, counts: { ...state.result.counts }, filter: state.filter } : { ready: false }; } },
    { name: 'set_review_filter', title: 'Filter the visible review', description: 'Change the review table to one of its existing filters. Does not modify the CSV data.', inputSchema: { type: 'object', properties: { filter: { type: 'string', enum: ['all', 'changed', 'exceptions', 'unmatched', 'unchanged'] } }, required: ['filter'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input) { if (!input || Object.keys(input).length !== 1 || !['all', 'changed', 'exceptions', 'unmatched', 'unchanged'].includes(input.filter)) throw new Error('Choose a supported review filter.'); if (!state.result) throw new Error('Compare two files or load the example first.'); state.filter = input.filter; state.page = 0; render(); return { filter: state.filter, counts: { ...state.result.counts } }; } }
  ];
  for (const tool of tools) { try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
