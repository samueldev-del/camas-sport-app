-- À EXÉCUTER UNE SEULE FOIS sur la DB Neon (via le SQL editor du dashboard)
-- Ajoute les colonnes nécessaires pour :
--   1) la galerie photo des équipes vainqueurs
--   2) les colonnes score_a/score_b et l'équipe gagnante (A/B/draw)

-- 1) Colonnes scores du match (au cas où elles n'existeraient pas encore — ALTER...IF NOT EXISTS)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_score INT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_score INT;

-- 2) Photo de l'équipe vainqueur + identité du vainqueur
ALTER TABLE matches ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_team TEXT
  CHECK (winner_team IN ('A','B','draw'));

CREATE INDEX IF NOT EXISTS idx_matches_done_date
  ON matches(match_date DESC) WHERE status = 'done';
