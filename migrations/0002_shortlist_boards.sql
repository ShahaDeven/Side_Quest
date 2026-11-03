-- Step 1.6: shortlists belong to a demo founder "board" (a random id kept in the visitor's browser), so
-- each reviewer gets their own shortlist instead of everyone sharing one. The Stage 1 table had no rows in
-- any deployed database, so it is rebuilt rather than altered (SQLite can't change a UNIQUE constraint).

DROP TABLE IF EXISTS shortlists;

CREATE TABLE shortlists (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id      TEXT NOT NULL,
  role_id       TEXT NOT NULL,
  candidate_ref TEXT NOT NULL,        -- 'seed:<id>' for demo candidates, 'gh:<login>' for a real one
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (board_id, role_id, candidate_ref)
);

CREATE INDEX shortlists_board_role ON shortlists (board_id, role_id);
