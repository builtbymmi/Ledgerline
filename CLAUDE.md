# Ledgerline

Personal finance app, served by GitHub Pages at https://builtbymmi.github.io/Ledgerline/ and installed on the owner's iPhone Home Screen.

## How it's built
- Source lives in `src/`: `head.html` (title + all CSS), `body.html` (app shell), `core.js` (parsing, categorizing, analytics), `ui.js` (views, import wizard, events), `sw.template.js` (offline cache).
- `src/build.sh` stitches them into the root `index.html` and `sw.js` (with a fresh cache version). **Edit files in `src/`, run `bash src/build.sh`, then commit both `src/` and the built files and push to `main`.** Pages redeploys in about a minute; the app picks it up the next time it's opened online.
- Libraries are vendored in `vendor/` (Chart.js 4.4.1, SheetJS 0.18.5, pdf.js 3.11.174). No build tooling or npm needed.

## Data
- All financial data is stored on the device only (localStorage key `ledgerline:v1`). Never commit personal data to this repo; it is public.
- To hand the owner new transactions, give him a `.json` file with `"kind": "ledgerline-import"` (fields: `title`, `accounts[{id,name,type,balance,balanceAsOf}]`, `transactions[{date,desc,amount,accountId,merchant,categoryId,notes}]`, optional `rules`, `categories`). They import it via Import; it merges, skips duplicates, and replaces charges whose notes say "Pending".
- Account ids are whatever the owner's data uses; match them by id or account name (the importer does both).
- The in-app PDF reader understands Navy Federal statements (`parseNFCUText` in `core.js`).
