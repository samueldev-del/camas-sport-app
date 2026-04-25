-- À EXÉCUTER UNE SEULE FOIS sur la DB Neon (via le SQL editor du dashboard Neon
-- ou via psql). Met à jour la contrainte sur attendances.status pour autoriser 'maybe'.
-- Sans ça, le backend renverra une 500 au premier vote "peut-être".

-- 1) Drop l'ancienne contrainte CHECK (le nom est généré par PG : <table>_<col>_check)
ALTER TABLE attendances
  DROP CONSTRAINT IF EXISTS attendances_status_check;

-- 2) Recrée la contrainte en incluant 'maybe'
ALTER TABLE attendances
  ADD CONSTRAINT attendances_status_check
  CHECK (status IN ('registered','present','late','absent','maybe'));
