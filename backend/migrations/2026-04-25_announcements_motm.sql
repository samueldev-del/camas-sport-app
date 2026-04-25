-- À EXÉCUTER UNE SEULE FOIS sur la DB Neon (via le SQL editor du dashboard)
-- Crée les tables pour les annonces du responsable et le vote « Joueur du jour ».

-- 1) Annonces publiées par l'admin, visibles publiquement sur l'accueil
CREATE TABLE IF NOT EXISTS announcements (
  id          SERIAL PRIMARY KEY,
  title       TEXT,
  body        TEXT NOT NULL,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_announcements_created
  ON announcements(pinned DESC, created_at DESC);

-- 2) Votes « Man of the Match » : un votant peut changer d'avis (UPSERT)
CREATE TABLE IF NOT EXISTS motm_votes (
  id          SERIAL PRIMARY KEY,
  match_id    INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  voter_id    INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  voted_id    INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_motm_match ON motm_votes(match_id);

-- 3) Consentement RGPD/DSGVO (optionnel, journalisation des consentements donnés)
CREATE TABLE IF NOT EXISTS consents (
  id           SERIAL PRIMARY KEY,
  player_id    INT REFERENCES players(id) ON DELETE SET NULL,
  ip_hash      TEXT,
  user_agent   TEXT,
  consent_kind TEXT NOT NULL,            -- ex: 'cookies', 'data_processing'
  granted      BOOLEAN NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
