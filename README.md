# CSV Data Quality Checker

A browser-based tool that scans a CSV file for data quality problems. **Everything runs locally: your file is never uploaded anywhere.**

## Features
- Drag-and-drop or file-picker import, sample CSV, BOM handling, delimiter auto-detection (comma, semicolon, tab), header on/off
- Own RFC 4180 parser: quoted fields, escaped quotes, commas and newlines inside cells, uneven rows, duplicate/empty column names
- Checks (each can be toggled): missing values (configurable tokens such as `N/A`, `NULL`, `-`), high-missing columns, duplicate rows (with ignorable columns), whitespace, case/spacing inconsistencies, mixed types, invalid emails (format only), constant columns, row-length problems
- Dashboard: summary cards, 0–100 quality score, findings filters (severity, type, column, row), details with examples and suggestions, column quality table, paginated preview with highlighted cells, cell inspector, value search, go-to-row
- Exports: JSON report, findings CSV, optional cleaned CSV (only the transformations you tick; preview of changes shown)
- Light/dark theme (persisted), responsive, keyboard accessible

## Quality score
`score = round(100 × (1 − flaggedCells / (rows × columns)))`. A cell is flagged once if any finding with affected rows touches it; severity labels are ignored. With zero data rows or columns the score is shown as N/A.

## Screenshots
_Add screenshots here: `docs/screenshot-light.png`, `docs/screenshot-dark.png`._

## Tech stack
HTML5, CSS3, vanilla JavaScript (ES modules), Vitest for tests, Vite (dev server/build only), GitHub Actions, GitHub Pages. No runtime dependencies.

## Structure
```
index.html
src/css/styles.css
src/js/{main,csv-parser,analyzer,rules,renderer,exporter,utils}.js
tests/{parser,analyzer,rules}.test.js
.github/workflows/tests.yml
```
Parsing, analysis and export-formatting code does not touch the DOM.

## Run locally
```bash
npm install
npm run dev      # Vite dev server
npm test         # Vitest
npm run build    # optional static build into dist/
```
All paths are relative, so the repo root can also be served by any static server.

## Deploy to GitHub Pages
1. Push to GitHub. 2. Settings → Pages → Deploy from a branch → `main` / `(root)`. The site works under a `/repo-name/` subpath because every URL is relative.

## Privacy & security
No network requests are made with your data. CSV values are rendered with `textContent` (never HTML), nothing is `eval`ed, and exports prefix cells starting with `=`, `+`, `-`, `@` (except plain numbers) with `'` to prevent spreadsheet formula injection. Original data is never modified.

## Known limitations
- 25 MB file limit; analysis runs on the main thread (no Web Worker), so very large files may briefly freeze the tab
- Type inference and inconsistency detection are heuristics and can be wrong; emails are format-checked only
- Date detection recognises ISO and `d/m/yyyy`-style formats only
- Cleaned export writes comma-delimited UTF-8 and treats all values as text

## License
MIT
