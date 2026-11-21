# Temporal — Transaction Research Lab

A working local MSc research prototype for detecting suspicious transaction patterns using account history, graph features, snapshot message passing and temporal node memory. The interface adapts the real **Amicro Mono Charts** components, Outfit typography, monochrome surfaces and spring buttons. No PaySwitch assets or design components are included.

## Start

The ZIP includes the compiled interface, source code, a synthetic dataset and a completed synthetic run. Node.js is only needed when editing the interface.

**macOS / Linux:** install Python 3.12, open a terminal in this folder, then:

```bash
bash run.sh
```

Open **http://127.0.0.1:8766**. First launch creates a private virtual environment and downloads Python packages. Later launches reuse it. Keep that terminal open; stop the server with Ctrl+C. On macOS, `Start.command` is a convenience wrapper. Python 3.11–3.14 is accepted; this build was tested on Python 3.12.14 and macOS arm64.

**Windows (PowerShell):**

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements-lock.txt
.venv\Scripts\python -m backend.server
```

The bundled run is demo data only. If `runtime/run.json` is absent, startup generates and trains a new demonstration automatically. All routes bind to loopback. This is a single-user research app, not a production financial service.

## Try the complete workflow

1. Open **Overview**. The initial view shows the completed held-out test window.
2. Press **Play replay**, pause or move the progress slider. Only transactions observed up to that time enter the displayed graph and queue.
3. Select a model and change review capacity. Changing capacity replays the same scores with the frozen threshold; it does not retrain or retune the threshold.
4. Open **Cases**, filter or search, then choose **Inspect**. The graph and evidence panel show observed associations, without ground-truth fraud labels.
5. Open **Experiments** for all four model results. The comparison always uses the primary capacity of 50 reviews per 10,000 validation arrivals, regardless of the replay selector.
6. Choose **Export results** to save metadata, metrics, environment versions, thresholds and dataset fingerprint as JSON.
7. Use **Dataset → Sample CSV** for the input format. Importing a valid file starts local training. **Reset demo** regenerates the synthetic dataset using the selected seed.

## Import real transaction files

Use only data you are authorised to analyse. Remove names, phone numbers, card details, passwords and tokens. Replace account identifiers with stable pseudonyms that are consistent across rows. The app does not send imported records to an external service; it stores the successful active dataset and results in `runtime/run.json` on your computer.

| Column | Requirement | Meaning |
|---|---|---|
| `timestamp` | Required | ISO 8601 with timezone, or Unix **seconds**; 1970–2100 |
| `source` | Required | Sender account identifier |
| `target` | Required | Different recipient account identifier |
| `amount` | Required | Positive, finite amount in a single normalised currency |
| `label` | Required to train | `0` legitimate, `1` suspicious/fraudulent according to a documented labelling policy |
| `episode_id` | Optional | Same identifier across transactions belonging to one independently labelled positive episode |
| `id` | Optional | Unique transaction identifier; generated if absent |
| `currency` | Optional | Currency code; defaults to USD, so explicitly supply GHS or another correct code |

Limits: **100–10,000 rows, 350 accounts, 5 MB, one currency**. Training and validation partitions must each contain positive and negative labels. Files are ordered by event time; identical times are processed together. Missing labels are not silently treated as legitimate. With no eligible validation episodes, threshold selection explicitly falls back to validation F1 and episode recall remains unavailable when there are no eligible test episodes.

Unlabelled inference on new data is **not yet an import mode**. Applying a synthetic-trained model to real records would not establish useful real-world accuracy. Upload a de-identified sample to adapt field mapping and plan a proper labelled or unsupervised evaluation.

## What is implemented

| Model | Implementation |
|---|---|
| Account history | Gradient boosting on 11 current-event and causal account-history features |
| Graph features | Gradient boosting on all 16 features, adding counterparty, pair, neighbourhood and flow information |
| Snapshot GNN | Directed message passing on cumulative graph snapshots from before each six-hour bin; edge classifier uses current features |
| Temporal GNN | GRU node memory, past-neighbour mean aggregation, edge scoring and timestamp-group message updates; truncated backpropagation over 16 timestamp groups |

Both neural models are compact experimental variants. They do not claim exact reproduction of a named published architecture. There are no learned account-ID embeddings. New accounts begin with zero history/memory. Graph memory is reconstructed from chronological observations when scoring a dataset.

Backend: Python, NumPy, scikit-learn, PyTorch, standard-library local HTTP server. Frontend: React, TypeScript, Vite, Tailwind, Recharts and Motion. The executable models and evaluation live in Python; the charts display actual API results.

## Evaluation protocol

- Partition by elapsed time: 60% train, 20% validation, 20% test. Same-time events are never split across partitions.
- Fit scaling, class weights and model parameters on training only. Replay with frozen weights; validation/test history can update causal memory without label feedback.
- Compute features before updating a timestamp group. Labels and episode identities do not enter prediction features or queue decisions.
- Choose a threshold from 0 and validation-score quantiles .50, .70, .85, .90, .95, .97, .99. Maximise timely episode recall, then minimise false reviews and alerts, then prefer the higher threshold. If no validation episodes are eligible, maximise validation F1 instead.
- Review capacity = validation transactions/hour × 50/10,000. Service slots occur at fixed intervals; unused slots are lost. Start each evaluation queue empty. Events at a service timestamp are enqueued before that slot.
- Consolidate alerts by sender account while a case is pending. Prioritise maximum score, creation time, then lexical account ID. Apply a six-hour cooldown after review; expire cases older than 24 hours.
- An eligible episode has all its annotated events within the evaluated window and a full 24-hour follow-up interval after onset. Credit it once when a reviewed case contains an observed member transaction within that deadline. Crossing and right-censored episodes are excluded.
- Report precision, recall, F1, trapezoidal PR-AUC, average precision, FPR, episode recall, false reviews per 1,000 events, review wait and detected-episode delay. Delay is conditional on timely detection; it excludes missed episodes. Partial replay metrics use the currently matured episode denominator.
- Mean scoring time is amortized over a complete pass and excludes feature extraction, queue processing and the interface. It is not p95 streaming latency. Feature timing is exported separately.

See `docs/RESEARCH_STATUS.md` for the limits and remaining research work. No metric in this package establishes novelty or generalises to real financial data.

## Develop and verify

```bash
# Backend tests
.venv/bin/python -m unittest discover -s tests -v

# Frontend (Node 22+ recommended; tested on Node 24.15.0)
npm ci
npm run build

# Optional frontend hot reload; run Python server in another terminal first
npm run dev
```

Development UI: http://127.0.0.1:5173; API proxy: http://127.0.0.1:8766. For a different backend port, pass `--port` and update the Vite proxy. A frontend rebuild is unnecessary for serving the bundled `dist/` directly from Python.

Folders: `backend/` models and API; `src/` interface; `tests/` causality and queue tests; `examples/` synthetic CSV; `runtime/` current run and model checkpoints; `docs/` protocol status; `third_party/` Amicro attribution and licence. Runtime checkpoints are for this prototype's own use. Do not load unknown pickle/joblib model files.

All generated files are local. Importing or rerunning replaces the active run and checkpoints after successful training; export results first if you need to keep previous runs. There is no automatic multi-run history, authentication, live payment connection or blocking action.
