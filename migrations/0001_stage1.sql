-- Stage 1: anonymous proof links, demo founder shortlist, seeded demo candidates.
-- No resume text is stored in any table.

CREATE TABLE proofs (
  id                TEXT PRIMARY KEY,
  user_id           INTEGER,            -- NULL in Stage 1 (anonymous); set by Stage 2 sign-in
  evidence_json     TEXT NOT NULL,
  delete_token_hash TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE shortlists (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id       TEXT NOT NULL,
  candidate_ref TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (role_id, candidate_ref)
);

CREATE TABLE seed_candidates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  is_demo       INTEGER NOT NULL DEFAULT 1
);
