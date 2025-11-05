# API

## Render Build

Render runs the API build with `npm run build` followed by the smoke test `npm run self:check-parse`.

Set the following environment variables for the Render service:

- `PUPPETEER_SKIP_DOWNLOAD=true`
- `OCR_ENABLED=true` (or `PARSER_OCR_ENABLED=true` depending on your config)
- `PARSE_SMOKE_PDF=api/fixtures/smoke_supplier_quote.pdf`
