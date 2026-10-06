"""Read generated review reports with an independent CSV implementation."""
from pathlib import Path
import csv, json, sys

here = Path(__file__).resolve().parent
root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else here / 'results'
manifest = json.loads((here / 'fixtures' / 'expected-results.json').read_text(encoding='utf-8'))
results = []
for spec in manifest['comparison_cases']:
    try:
        file = root / 'reports' / (spec['id'] + '.csv')
        with file.open(encoding='utf-8-sig', newline='') as handle:
            rows = list(csv.reader(handle, strict=True))
        actual = json.loads(file.with_suffix('.json').read_text(encoding='utf-8'))
        assert len(rows) == len(actual['rows']) + 1, 'Unexpected report row count'
        assert all(len(row) == 9 for row in rows), 'Report row width differs'
        assert all(row[0] == 'REVIEW ONLY - NOT AN IMPORT FILE' for row in rows[1:]), 'Missing review-only label'
        if spec['id'] == 'formula-looking-sku-and-report':
            expected = [item['safe_csv_cell_content'] for item in spec['expected']['report_text_cells']]
            assert [row[2] for row in rows[1:]] == expected, 'Formula-safe text differs'
        results.append({'id': spec['id'], 'passed': True, 'data_rows': len(rows)-1})
    except Exception as error:
        # Avoid recording host-specific absolute paths in portable receipts.
        results.append({'id': spec['id'], 'passed': False, 'error_type': type(error).__name__})
output = {'parser': 'Python standard csv.reader(strict=True)', 'passed': sum(r['passed'] for r in results),
          'failed': sum(not r['passed'] for r in results), 'results': results}
(root / 'export-results.json').write_text(json.dumps(output, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'passed': output['passed'], 'failed': output['failed']}, indent=2))
sys.exit(1 if output['failed'] else 0)
