# Forum dream entrypoint execution — 2026-09-07

The forum build and evaluator pipelines now run under `bash -o pipefail -c`, so `tail` cannot turn a failed Cargo command into success. A regression test injects deterministic command failure into every configured build/evaluator pipeline. The required bench and thread-model entrypoints were executed locally and returned zero; the thread filter ran ten tests. The dream-machine compiler accepted the configuration and produced its routine prompt.

This is evaluator execution, not a complete `/dream` night. The available CLI compiles/schedules the agent prompt; it does not run the research/mutation/evaluation/witness/ledger journey by itself. No row was appended to the historical seven-night INCONCLUSIVE ledger and no ACCEPT or promoted lineage is claimed. The optional performance evaluator and remote nightly runtime are not certified here.

Mock Darwin is a smoke-class harness signal: the accepted [dream-machine ADR-0003](../../../dream-machine/docs/adrs/ADR-0003-darwin-bound-guard.md) already records its zero ranking signal and separately limits the bounds check to a diagnostic, not a gate veto. No missing forum/VisionFlow ADR-0057 has been invented or ratified.

Full evidence: [estate execution](../../../VisionFlow/docs/estate-review/closeout/2026-09-07-execution-federation.md).
