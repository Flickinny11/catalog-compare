# CatalogCompare synthetic acceptance fixtures

Created 2026-10-06. These are independent test inputs and expected outcomes, not supplier data, an import file, or proof that the application passes.

Use `expected-results.json` as the complete machine-readable specification. It contains exact raw rows, selected columns, expected output keys, numeric values as exact decimal strings, logical record references, file hashes and export cell expectations. `fixture-validation.json` records the completed package-integrity checks.

## Comparison matrix

Counts below refer to distinct SKU keys. Missing-SKU records are counted separately. A conflicted key must never also count as changed, unchanged, added or removed.

| Run | Before → after files | Options | Changed | Unchanged | Added | Removed | Conflicts | Invalid | Essential expectation |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| RFC 4180 + BOM | `01-rfc-before.csv` → `01-rfc-after.csv` | exact; dot/dot | 1 | 4 | 0 | 0 | 0 | 0 | Five logical data records despite quoted embedded CRLF; BOM stripped from first header; quoted commas and quotes preserved. |
| Exact default | `02-exact-before.csv` → `02-exact-after.csv` | trim OFF; dot/dot | 1 | 1 | 4 | 4 | 0 | 0 | `0007` ≠ `7`; `abc` ≠ `ABC`; edge and interior whitespace preserved. |
| Explicit trim | Same pair 02 | trim ON; dot/dot | 2 | 1 | 3 | 3 | 0 | 0 | Only edge whitespace removed. No case folding or interior-space collapse. |
| Duplicate keys | `03-duplicates-before.csv` → `03-duplicates-after.csv` | exact; dot/dot | 0 | 1 | 0 | 0 | 3 | 0 | Duplicate keys on either side blocked, including two identical values. |
| Trim off | `04-trim-collision-before.csv` → `04-trim-collision-after.csv` | trim OFF | 0 | 2 | 0 | 0 | 0 | 0 | `A` and ` A ` are distinct. |
| Trim collision | Same pair 04 | trim ON | 0 | 0 | 0 | 0 | 1 | 0 | Trimming creates a duplicate on both sides; never choose the first/last row. |
| Missing data vs zero | `05-missing-before.csv` → `05-missing-after.csv` | exact; dot/dot | 0 | 1 | 0 | 0 | 0 | 4 keyed + 4 unkeyed source rows | Empty or whitespace-only prices are missing, not 0. Blank/whitespace-only SKUs invalid and not matched together. |
| Identifiers as text | `06-identifiers-before.csv` → `06-identifiers-after.csv` | exact; dot/dot | 2 | 3 | 0 | 0 | 0 | 0 | Keep `1e3`, `1000`, `000001`, `9007199254740993`, `9007199254740992` distinct. |
| Decimal and field selection | `07-decimal-dot-before.csv` → `07-decimal-comma-after.csv` | Item/Cost dot → Code/Net price comma | 0 | 8 | 0 | 0 | 0 | 14 | Compare chosen value columns, not Quantity. `1.234` and `1,234` both mean decimal 1.234 under their explicit formats. Invalid grouping/exponents/text stay invalid. |
| Zero and decimal change | `08-value-changes-before.csv` → `08-value-changes-after.csv` | exact; dot/dot | 4 | 0 | 1 | 1 | 0 | 0 | 0→5 is a change; 5→0 is a change; 0.30−0.10 displays 0.20 without binary residue. Zero-baseline percentage undefined. |
| Formula-looking identifiers | `09-formula-before.csv` → `09-formula-after.csv` | exact; dot/dot | 10 | 0 | 0 | 0 | 0 | 0 | Raw keys stay intact for matching; formula safety applied only to report export text cells. |

## Malformed-file matrix

Each file has a header and should be rejected with a useful error. Never silently return a report using only the valid prefix or pad/truncate the bad row.

| File | Expected error | Logical record |
|---|---|---:|
| `10-malformed-unterminated.csv` | Quoted field never closed; contains an embedded newline | 3 |
| `11-malformed-width-short.csv` | 2 fields for a 3-field header | 3 |
| `12-malformed-width-long.csv` | 4 fields for a 3-field header | 3 |
| `13-malformed-after-quote.csv` | Non-delimiter characters after closing quote | 2 |
| `14-malformed-bare-quote.csv` | Quote inside an unquoted field | 2 |

Logical record numbering includes the header as record 1; a quoted embedded newline does not begin a new record. Some permissive CSV libraries accept a bare quote. This test intentionally requires a clear error rather than silently accepting structurally ambiguous input.

## Confirmed numeric contract

The requested decimal dot/comma setting does not specify thousands grouping. To avoid guessing, these fixtures use an explicitly conservative contract:

- Trim numeric value edge whitespace; this is independent of the SKU-trim option.
- Accept optional `+`/`-`, digits, and at most the selected decimal separator. The entire value must conform.
- Integers, leading zeroes in numeric values, signed zero and negative values are valid.
- Reject grouping commas/dots/spaces/nonbreaking spaces, currency symbols/suffixes, exponent notation, hexadecimal, Infinity, NaN, underscores, parentheses, formulas and wrong-decimal strings.
- Scientific-looking **SKU identifiers remain ordinary text**. This numeric rule applies only to the selected value field.
- For a negative starting value, no percentage convention is prescribed. For a zero starting value, show no finite/infinite percentage. These checks apply only if percentages are part of the app.

The product owner accepted this grammar for the current release. Future versions may intentionally change it. If so, revise the corresponding expectations explicitly rather than silently guessing a locale or accepting `parseFloat` prefixes. Rejecting grouped values is an initial safety contract, not a claim that these data formats are inherently invalid.

## Report export examples

The JSON includes the complete list. These are CSV **cell contents before RFC 4180 serialization**, not raw CSV lines.

| Raw untrusted text | Expected safe report text |
|---|---|
| `=1+1` | `'=1+1` |
| `+SUM(1,2)` | `'+SUM(1,2)` |
| `-2+3` | `'-2+3` |
| `@SUM(1,2)` | `'@SUM(1,2)` |
| Two spaces then `=1+1` | Apostrophe, the same two spaces, then `=1+1` |
| Tab/CR/LF then `=1+1` | Apostrophe before the complete original text |
| `'=1+1` | Existing apostrophe retained; no additional apostrophe |
| `SAFE-SKU` | Unchanged |

CSV quoting alone does not neutralize a formula. Preserve the raw source key internally, apply the export escape, then serialize quotes/commas/newlines correctly. Report downloads should state that they are comparison reports and not supplier/import-ready files. Validated numeric output fields can be serialized as numbers rather than untrusted strings.

## What was verified

`fixture-validation.json`: PASS. All 18 valid CSVs round-trip through Python's standard CSV reader to the exact authored fields; all 23 file hashes match; all 11 expected-run counts balance; exact keys, headers, selected fields and BOM/CRLF assertions are checked. Five intentionally malformed inputs carry explicit failure expectations. This integrity check does not run or duplicate application reconciliation logic, and no site files were accessed or modified.
