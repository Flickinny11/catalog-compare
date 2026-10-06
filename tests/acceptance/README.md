# CatalogCompare acceptance tests

Synthetic CSV acceptance fixtures and a portable runner for CatalogCompare. The fixtures were written before the implementation was inspected. No real catalog, supplier, customer, account, or payment data is included.

## Run

Requirements: Node.js 22 or newer and Python 3. No third-party packages, network access, installation, or browser session are needed.

Copy this entire directory into the source repository, for example as `tests/acceptance/`. From the repository root, run:

```sh
node tests/acceptance/run-core.mjs dist/core.mjs
python3 tests/acceptance/verify-exports.py
```

Change `dist/core.mjs` to the actual location of the application core. Both commands return a nonzero exit status on failure. To put generated receipts elsewhere:

```sh
node tests/acceptance/run-core.mjs dist/core.mjs /tmp/catalog-compare-results
python3 tests/acceptance/verify-exports.py /tmp/catalog-compare-results
```

The first command runs the actual exported functions and writes comparison reports. The second parses those reports with Python's independent standard CSV reader, checking row counts, widths, review-only labels and exact authored formula-safe cell contents. Neither runner modifies application source.

## Coverage

- 23 authored CSV inputs: 18 valid files and 5 malformed files.
- 11 independent comparison scenarios with exact expected results.
- UTF-8 BOM, CRLF, quoted commas, doubled quotes, Unicode, embedded newlines and trailing empty fields.
- Leading-zero, case-sensitive and scientific-looking SKU identifiers; integers above JavaScript's safe integer range stay text.
- Explicit edge trimming, trim-induced duplicate keys, duplicates on either side and identical duplicate values.
- Missing keys, missing numeric values, zero, signed decimals, separate decimal formats and separately selected columns.
- Rejection of grouping, currency, exponent notation, hexadecimal, nonfinite values, numeric prefixes and malformed quote/row structure.
- Unmatched rows with missing or malformed values remain exceptions.
- Formula-looking report text, including leading whitespace and control characters, is escaped without changing comparison keys.
- Prototype-like identifiers remain ordinary map keys.
- Row limit: 10,000 accepted and 10,001 rejected.
- Column limit: 199 and 200 accepted; 201 rejected in headers or data rows.
- Field limit: 65,535 and 65,536 accepted; 65,537 rejected, exercising unquoted fields, quoted fields, escaped quotes, headers and embedded newlines.
- Unicode boundary: the implementation counts JavaScript UTF-16 code units; a supplementary-plane character occupies two units.
- Numeric value limit: 100 characters accepted and 101 rejected.

The core suite contains **95 checks**. The export suite covers **11 generated reports**. `fixtures/EXPECTED-MATRIX.md` explains expected classifications; `fixtures/expected-results.json` contains the complete authored data and expected results. Exact numbers in the manifest use decimal strings instead of binary floating-point literals.

## Receipts and scope

`results/core-results.json` identifies the source by SHA-256, shows each check and contains no absolute source path. `results/export-results.json` records the independent CSV checks. The reports under `results/reports/` contain only the synthetic fixture values.

`results/prior-ui-state-results.json` is a separate prior receipt for five actual-module tests against jsdom: failed uploads invalidating old reports, pending reads invalidating results, latest-selection precedence, and clearing pending uploads. It identifies the precise app hash tested. It is retained as evidence, but this bundle's dependency-free commands do not rerun that UI suite. It is not a live browser or device verification claim.

These tests do not exercise native file pickers, rendered layout, accessibility, actual browser downloads, deployment, store imports, or an entire commercial catalog workflow. They neither establish payment nor certify arbitrary untrusted files as safe for every spreadsheet application.

## Maintenance

Change expectations deliberately when the product's documented contract changes. Do not loosen a failing assertion solely to match the implementation. Parser limits are exercised with generated strings to keep the checked-in data small. Report files are comparison reports, not import templates.
