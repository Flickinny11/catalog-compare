export function parseCSV(input, delimiter = ',') {
  if (![',', ';', '\t'].includes(delimiter)) throw new Error('Choose comma, semicolon, or tab as the separator.');
  const text = String(input).replace(/^\uFEFF/, '');
  if (!text.trim()) throw new Error('This file is empty. Choose a CSV with a header and data rows.');
  const records = []; let row = [], field = '', quoted = false, closed = false, started = false;
  function appendField(ch) { if (field.length >= 65536) throw new Error(`Record ${records.length + 1}: a field exceeds the 65,536-character limit.`); field += ch; }
  function finishField() { if (row.length >= 200) throw new Error('This version supports up to 200 columns per file.'); row.push(field); field = ''; closed = false; started = false; }
  function finishRow() { finishField(); records.push(row); row = []; if (records.length > 10001) throw new Error('This version supports up to 10,000 data rows per file.'); }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { appendField('"'); i++; } else { quoted = false; closed = true; } }
      else appendField(ch);
      continue;
    }
    if (closed && ch !== delimiter && ch !== '\r' && ch !== '\n') throw new Error(`Record ${records.length + 1}: unexpected text after a closing quote.`);
    if (ch === '"') { if (started || field.length) throw new Error(`Record ${records.length + 1}: a quote appears inside an unquoted field.`); quoted = true; started = true; }
    else if (ch === delimiter) finishField();
    else if (ch === '\n' || ch === '\r') { finishRow(); if (ch === '\r' && text[i + 1] === '\n') i++; }
    else { appendField(ch); started = true; }
  }
  if (quoted) throw new Error(`Record ${records.length + 1}: a quoted field was never closed.`);
  if (started || closed || field || row.length) finishRow();
  const headers = records.shift();
  if (!headers || headers.length < 2) throw new Error('At least two columns are needed. Check the file separator.');
  if (headers.some(h => !h.trim())) throw new Error('Every column needs a nonempty header.');
  if (new Set(headers).size !== headers.length) throw new Error('Two columns have the same header. Give them distinct names before comparing.');
  const rows = records.map((values, i) => { if (values.length !== headers.length) throw new Error(`Record ${i + 2}: found ${values.length} fields; the header has ${headers.length}. Check quotes and separators.`); return { record: i + 2, values }; });
  if (!rows.length) throw new Error('This file has headers but no data rows.');
  return { headers, rows };
}

export function parseDecimal(raw, separator = '.') {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: false, reason: 'Missing value' };
  if (s.length > 100) return { ok: false, reason: 'Numeric values must be 100 characters or fewer' };
  const pattern = separator === ',' ? /^[+-]?\d+(?:,\d+)?$/ : /^[+-]?\d+(?:\.\d+)?$/;
  if (!pattern.test(s)) return { ok: false, reason: `Not a plain decimal (${separator === ',' ? 'comma' : 'dot'} format)` };
  let v = s.replace(',', '.').replace(/^\+/, '');
  let negative = v.startsWith('-'); if (negative) v = v.slice(1);
  let [whole, fraction = ''] = v.split('.'); whole = whole.replace(/^0+(?=\d)/, ''); fraction = fraction.replace(/0+$/, '');
  if (whole === '0' && !fraction) negative = false;
  return { ok: true, value: (negative ? '-' : '') + whole + (fraction ? '.' + fraction : '') };
}

export function decimalDelta(before, after) {
  const digits = Math.max((before.split('.')[1] || '').length, (after.split('.')[1] || '').length);
  const scaled = v => { const negative = v.startsWith('-'); const [w, f = ''] = v.replace(/^-/, '').split('.'); return BigInt(w + f.padEnd(digits, '0')) * (negative ? -1n : 1n); };
  let d = scaled(after) - scaled(before); const sign = d < 0n ? '-' : d > 0n ? '+' : ''; if (d < 0n) d = -d;
  let s = d.toString().padStart(digits + 1, '0');
  if (digits) s = s.slice(0, -digits) + '.' + s.slice(-digits);
  return sign + s;
}

export function compareTables(before, after, options) {
  const { beforeKey, beforeValue, afterKey, afterValue, beforeDecimal = '.', afterDecimal = '.', trimKeys = false } = options;
  for (const [t, k, v] of [[before, beforeKey, beforeValue], [after, afterKey, afterValue]]) {
    if (![k, v].every(i => Number.isInteger(i) && i >= 0 && i < t.headers.length)) throw new Error('Choose an identifier and value column for both files.');
    if (k === v) throw new Error('The identifier and value must be different columns.');
  }
  const results = [], maps = [];
  for (const [table, keyIndex, valueIndex, side] of [[before, beforeKey, beforeValue, 'catalog'], [after, afterKey, afterValue, 'supplier']]) {
    const map = new Map();
    for (const row of table.rows) {
      const rawKey = row.values[keyIndex], key = trimKeys ? rawKey.trim() : rawKey;
      const item = { key, rawKey, rawValue: row.values[valueIndex], record: row.record };
      if (!key.trim()) results.push({ key: rawKey, status: 'invalid', reason: `Missing SKU in ${side}`, before: side === 'catalog' ? [item] : [], after: side === 'supplier' ? [item] : [], delta: '' });
      else { if (!map.has(key)) map.set(key, []); map.get(key).push(item); }
    }
    maps.push(map);
  }
  const [bm, am] = maps;
  for (const key of new Set([...bm.keys(), ...am.keys()])) {
    const b = bm.get(key) || [], a = am.get(key) || [];
    const r = { key, before: b, after: a, delta: '', reason: '' };
    if (b.length > 1 || a.length > 1) { r.status = 'conflict'; r.reason = `Duplicate SKU: ${b.length} catalog / ${a.length} supplier rows`; }
    else if (!b.length) { const value = parseDecimal(a[0].rawValue, afterDecimal); r.status = value.ok ? 'added' : 'invalid'; r.reason = value.ok ? 'Supplier only. No catalog match; not an instruction to add.' : `Supplier only. ${value.reason}; no catalog match.`; }
    else if (!a.length) { const value = parseDecimal(b[0].rawValue, beforeDecimal); r.status = value.ok ? 'removed' : 'invalid'; r.reason = value.ok ? 'Catalog only. Not supplied; not an instruction to remove or zero.' : `Catalog only. ${value.reason}; not supplied by the update.`; }
    else {
      const bv = parseDecimal(b[0].rawValue, beforeDecimal), av = parseDecimal(a[0].rawValue, afterDecimal);
      if (!bv.ok || !av.ok) { r.status = 'invalid'; r.reason = [!bv.ok && `Catalog: ${bv.reason}`, !av.ok && `Supplier: ${av.reason}`].filter(Boolean).join('; '); }
      else { r.status = bv.value === av.value ? 'unchanged' : 'changed'; r.beforeNumber = bv.value; r.afterNumber = av.value; r.delta = decimalDelta(b[0].rawValue.trim().replace(',', '.'), a[0].rawValue.trim().replace(',', '.')); r.reason = r.status === 'changed' ? 'Exact SKU match; value differs' : 'Exact SKU match; same numeric value'; }
    }
    results.push(r);
  }
  const counts = { changed: 0, unchanged: 0, added: 0, removed: 0, conflict: 0, invalid: 0 };
  for (const r of results) counts[r.status]++;
  return { rows: results, counts, options: { ...options }, sourceCounts: { before: before.rows.length, after: after.rows.length } };
}

export function safeReportCell(value) {
  const s = String(value ?? '');
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s) ? "'" + s : s;
}
export function reportCSV(result) {
  const rows = [['Report type', 'Status', 'SKU as text', 'Catalog records', 'Supplier records', 'Catalog raw value', 'Supplier raw value', 'Numeric change', 'Review note'], ...result.rows.map(r => ['REVIEW ONLY - NOT AN IMPORT FILE', r.status, r.key, r.before.map(x => x.record).join('; '), r.after.map(x => x.record).join('; '), r.before.map(x => x.rawValue).join(' | '), r.after.map(x => x.rawValue).join(' | '), r.delta, r.reason])];
  return '\uFEFF' + rows.map(row => row.map(value => '"' + safeReportCell(value).replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n';
}
