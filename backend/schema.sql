-- CAMAS Sport App — schema
-- Timezone: all timestamps stored in UTC (TIMESTAMPTZ), converted to Europe/Berlin in queries.

CREATE TABLE IF NOT EXISTS players (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  pin         TEXT NOT NULL,
  rating      NUMERIC(3,1) NOT NULL DEFAULT 5.0 CHECK (rating >= 1 AND rating <= 10),
  is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id            SERIAL PRIMARY KEY,
  match_date    DATE NOT NULL UNIQUE,
  kickoff_local TIME NOT NULL DEFAULT '10:00',
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','closed','done')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendances (
  id           SERIAL PRIMARY KEY,
  match_id     INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id    INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  vote_time    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  arrival_time TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'registered'
               CHECK (status IN ('registered','present','late','absent','maybe')),
  is_late      BOOLEAN NOT NULL DEFAULT FALSE,
  team         TEXT CHECK (team IN ('A','B','C','D')),
  UNIQUE (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS goals (
  id         SERIAL PRIMARY KEY,
  match_id   INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id  INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  goals      INT NOT NULL DEFAULT 0 CHECK (goals >= 0),
  assists    INT NOT NULL DEFAULT 0 CHECK (assists >= 0),
  UNIQUE (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS fines (
  id          SERIAL PRIMARY KEY,
  player_id   INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id    INT REFERENCES matches(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL,
  amount      NUMERIC(6,2) NOT NULL,
  paid        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id          SERIAL PRIMARY KEY,
  reason      TEXT NOT NULL,
  amount      NUMERIC(6,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id          SERIAL PRIMARY KEY,
  title       TEXT,
  body        TEXT NOT NULL,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS motm_votes (
  id          SERIAL PRIMARY KEY,
  match_id    INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  voter_id    INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  voted_id    INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, voter_id)
);

CREATE TABLE IF NOT EXISTS consents (
  id           SERIAL PRIMARY KEY,
  player_id    INT REFERENCES players(id) ON DELETE SET NULL,
  ip_hash      TEXT,
  user_agent   TEXT,
  consent_kind TEXT NOT NULL,
  granted      BOOLEAN NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendances_match ON attendances(match_id);
CREATE INDEX IF NOT EXISTS idx_goals_match ON goals(match_id);
CREATE INDEX IF NOT EXISTS idx_fines_player ON fines(player_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_motm_match ON motm_votes(match_id);
