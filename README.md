# Catalog Compare

A free, local-first CSV review utility for comparing a current catalog with a supplier update. Built with AI assistance by Logan Baird. Independent of Shopify and other commerce platforms.

Select two UTF-8 CSV files, explicitly map the SKU and numeric value columns, and inspect changed values, duplicates, missing values and unmatched identifiers. A synthetic example is included. Nothing connects to a store or modifies the source files.

## Run locally

No dependencies or build step are needed. With Python 3:

```sh
python3 -m http.server 8775 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8775/` in a modern browser. Files are processed in the tab, without file-content uploads, analytics or persistence. The host still receives ordinary page requests; the optional service asks users to email anonymized samples separately from the app.

## What it does

- Keeps leading zeros, letter case and identifier text intact. Optional edge trimming is explicit.
- Supports comma, semicolon and tab file separators, and independently selected dot/comma decimal formats.
- Holds duplicate identifiers and missing or malformed values for review. Blank is never zero; unmatched never means delete.
- Compares decimal values exactly and calculates their differences without binary floating-point rounding.
- Searches and filters review rows, with 50-row pagination.
- Generates a review-only CSV with source record numbers and formula-like text escaped. `View CSV` provides the complete, selectable report when a browser does not download it.
- Provides progressive WebMCP tools for loading the synthetic example, reading aggregate counts and selecting a filter in supported browsers. These tools do not return source rows.

The exported file is **not an import template**. A user must decide whether two selected numeric fields represent the same unit, currency and business meaning. The app does not infer cost versus retail price, variants, units, currency conversions or fuzzy matches.

## Limits

Per file: 5,000,000 bytes, 10,000 data rows, 200 columns and 65,536 UTF-16 code units per field. Numeric values are limited to 100 characters. Only plain signed decimals are accepted; grouping, currency symbols and exponential notation are rejected. XLSX, remote URLs, spreadsheets with formulas, multiple value fields and automatic store updates are outside this version.

CSV parsing handles BOM, CRLF, escaped quotes and quoted multiline fields. Duplicate or empty headers and malformed record widths are rejected. Record numbers include the header as record 1 and treat a multiline quoted field as one record. Spreadsheet applications vary; always inspect the report before using its contents elsewhere.

## Verification

```sh
node tests/acceptance/run-core.mjs dist/core.mjs
python3 tests/acceptance/verify-exports.py
```

The independent fixture suite contains 95 core checks and 11 export checks. See `tests/acceptance/README.md` for methodology, synthetic inputs, exact expectations and limitations. Browser evidence is in `docs/browser-verification.json`. Native download completion was not confirmed by the available browser tooling; the visible report fallback was exercised and its actual output independently parsed.

## Optional service

The former 24-hour offer closed on October 8 at 2:20 a.m. America/Chicago. A separate, narrower $35 express review is available only until October 9, 2026 at 04:20:13 UTC (October 8, 11:20:13 p.m. Central), subject to sample fit and capacity. The free app remains available.

- One pair of anonymized CSVs, up to 50 data rows each, one identifier and numeric column per file, same meaning/units/currency.
- Mapping note, review-only CSV, and explanations for up to five distinct identifier exception groups. Each missing-identifier row counts separately.
- Complete inputs and scope must both be accepted by the cutoff; an email alone does not reserve a slot. One active job at a time. No customer order is accepted automatically by this website.
- Confirmed start and delivery times before acceptance. Initial report within 90 minutes, one scoped clarification/rerun if requested within the following 15 minutes, final delivery within two hours of start.
- Payment through Stripe only after buyer approval of the agreed report. No promise that approval/payment will arrive during the experiment.
- AI assistance disclosed. No store access, import files, live changes, confidential/customer information, extra fields or ongoing support.

The card defaults to closed. Its isolated `review-offer.mjs` module enables the email link only during the intake window and removes it after expiry, including on a click at the cutoff. This is presentation logic based on the browser clock; manual acceptance must also enforce the UTC cutoff and available capacity. No payment or file transfer occurs automatically. No accepted order or revenue is inferred from publication.

## License

Original code and synthetic fixtures are available under the MIT license. No real customer or supplier data is included.
