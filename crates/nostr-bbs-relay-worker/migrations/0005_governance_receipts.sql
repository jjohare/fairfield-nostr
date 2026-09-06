-- ADR-2010: durable governance outcome receipts.
--
-- One row per signed governance event, keyed by the FULL 64-hex event id. The
-- row is the durable replay record the ADR requires where the storage boundary
-- prevents spanning the envelope write and the projection in one transaction:
-- it is written at `relay-accepted` immediately after the envelope is stored,
-- and transitions to `projection-committed` inside the same D1 batch that
-- writes the decision row and the case state.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS governance_receipts (
    -- Correlation anchor: the full signed event id, never truncated.
    event_id TEXT PRIMARY KEY NOT NULL,
    kind INTEGER NOT NULL,
    case_id TEXT NOT NULL,
    -- The 31402 ActionRequest this response answers, where it cites one.
    request_event_id TEXT,
    signer_pubkey TEXT NOT NULL,
    decision_outcome TEXT,
    target_operation TEXT,
    supersedes_event_id TEXT,
    -- signed | relay-accepted | projection-committed | projection-failed.
    -- A stage certifies only itself: `relay-accepted` means the envelope is
    -- stored, never that the decision took effect.
    stage TEXT NOT NULL,
    stage_error TEXT,
    -- broker_decisions.decision_id, set when the projection commits.
    decision_id TEXT,
    signed_at INTEGER NOT NULL,
    accepted_at INTEGER,
    projected_at INTEGER,
    -- How many times this exact signed event was redelivered. A replay is
    -- counted; the mutation is not re-run.
    replays INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_governance_receipts_case ON governance_receipts(case_id);
CREATE INDEX IF NOT EXISTS idx_governance_receipts_stage ON governance_receipts(stage);
CREATE INDEX IF NOT EXISTS idx_governance_receipts_request ON governance_receipts(request_event_id);
CREATE INDEX IF NOT EXISTS idx_governance_receipts_signer ON governance_receipts(signer_pubkey);
