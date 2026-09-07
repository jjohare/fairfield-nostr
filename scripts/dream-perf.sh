#!/usr/bin/env bash
# Dream-cycle evaluator (advisory): criterion benches for nostr-bbs-core,
# including the thread-model benches added 2026-09-07 (thread_tree_build,
# reply_parent_verify, thread_page_assemble). Checked-in script because a
# quoted grep pattern inside dream.config.json does not survive the annexe
# dispatch (fish login → bash -lc → bash -o pipefail -c): the 2026-09-07
# revival run recorded exit 127 for the inline form.
set -o pipefail
cargo bench -p nostr-bbs-core --benches -- --warm-up-time 1 --measurement-time 3 2>&1 \
  | grep -E 'time:|thrpt:|Benchmarking|regressed|improved|^bench' \
  | tail -80
