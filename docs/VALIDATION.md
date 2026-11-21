# Validation record

Verified on 16 November 2026, macOS arm64, Python 3.12.14, Node 24.15.0.

- **31 automated Python tests passed.** The suite executes all four models, checks finite outputs and metric bounds, repeats training after changing only test labels, checks frozen thresholds, verifies past-only features and neural inference, timestamp ties, queue priority/capacity/cooldown/expiry, episode credit/censoring, CSV validation and localhost API controls.
- **4 API tests passed again** after the final origin/port configuration change. Full output is in `TEST_RESULTS.txt`.
- **TypeScript check and production Vite build passed.** The distributed interface is built from the included source; assets and fonts are bundled locally.
- **Browser verified at 1280px and 390px width.** Both views had matching document and viewport widths, with no page-level horizontal overflow.
- Switched graph-feature and temporal models and review capacity; the displayed cases and review totals changed.
- Searched an account, inspected its case, and verified the graph focused on the selected account.
- Reset and played the replay; the empty state, advancing timeline and observed transactions worked.
- Imported `examples/synthetic-transactions.csv` through the browser's file chooser, observed training, and verified the imported 3,024-event / 120-account dataset and results.
- Restored the synthetic demonstration through the UI.
- Downloaded results using the Export results link.
- No browser error or warning messages were reported during final inspection.

The first test iteration contained an overbroad assertion that confused chart-axis `label` keys with event ground-truth labels. The assertion was corrected to inspect public event objects. Final tests verify that event labels and episode IDs do not appear in investigation evidence.

These checks validate prototype behaviour. They do not establish statistical significance, production security, real-world detection quality or research novelty. Windows and Linux startup instructions are included, but only macOS was executed in this session.
