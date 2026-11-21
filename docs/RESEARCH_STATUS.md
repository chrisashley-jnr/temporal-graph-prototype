# Research status and implementation boundaries

This prototype turns the proposal into executable software. Its primary contribution at this stage is a testable experimental framework, not a verified scientific finding.

## Working now

- Deterministic 14-day transaction generator: 3,024 events, 120 accounts, 42 constructed episodes. Includes ordinary payments, legitimate payroll-like batches, fan-in/forwarding and chain patterns. All labels are synthetic construction metadata.
- Four trained model families and chronological held-out evaluation.
- A capacity-limited queue with account consolidation, expiry and cooldown.
- Causal feature and neural-memory handling, tied timestamp semantics, validation-only threshold tuning, and offline episode credit.
- Local CSV ingestion, replay, investigation panels, model comparison and JSON result export.
- A test suite covering causal invariants, label separation, queue mechanics, input errors, all four model executions and loopback API behaviour.

## Required before dissertation claims

1. Verify an accessible dataset's provenance, permissions, label semantics, timestamp resolution and episode identifiers. No AMLworld dataset is included or verified here. Episode IDs must not be inferred from the same detector being evaluated.
2. Align implementation and baselines with the final literature review and supervisor-approved questions. The compact neural models here are not exact reproductions of Shi, Tang or another paper.
3. Add multiple independent seeds, chronological folds, model-specific tuning under a comparable compute budget, uncertainty intervals and paired comparisons. This bundled run has one seed and three neural epochs.
4. Measure false positives separately on legitimate high-volume activity and other meaningful subgroups. The generator contains benign batches, but the current export does not yet provide that stratified analysis.
5. Test ablations: remove temporal memory, neighbour aggregation, selected coordination features and queue policies. Evaluate unseen accounts, changing activity patterns and sensitivity to thresholds/capacity/deadlines.
6. Quantify exact per-event end-to-end latency and memory use on representative workloads. Current timing is CPU pass-average inference timing only. Snapshot adjacency is dense; temporal replay is serial. Neither is designed for production scale.
7. Add independent request/session/device signals if claiming automated attack or bot attribution. Transaction topology alone does not prove automation or intent.
8. Compare any proposed architectural or evaluation contribution against full-text prior work before claiming novelty. This prototype does not establish a research gap by itself.

## Known scope limits

The current pipeline is supervised and single-dataset. It does not ingest unlabelled new files for deployment-style scoring, preserve an experiment history automatically, offer explanations of model causality, connect to a live payment processor, store investigator decisions, or block accounts. Case inspection shows observed evidence and simulated review status. Imported labels are accepted as supplied, not verified. Model scores are not calibrated probabilities.

The graph panel displays a bounded neighbourhood from the latest 90 observed transactions plus the selected case; models use their full allowed causal histories. The dashboard is a research inspection tool, not an operational financial decision system.
