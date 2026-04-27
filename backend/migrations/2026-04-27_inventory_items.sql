-- À exécuter une seule fois sur la base Neon.
-- Ajoute l'inventaire matériel de la section sport et un jeu initial d'articles.

CREATE TABLE IF NOT EXISTS inventory_items (
  id               SERIAL PRIMARY KEY,
  category         TEXT NOT NULL,
  name             TEXT NOT NULL,
  quantity_total   INT NOT NULL DEFAULT 0 CHECK (quantity_total >= 0),
  quantity_ready   INT NOT NULL DEFAULT 0 CHECK (quantity_ready >= 0 AND quantity_ready <= quantity_total),
  storage_location TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category, name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_category_name
  ON inventory_items(category, name);

INSERT INTO inventory_items (category, name, quantity_total, quantity_ready, storage_location, notes)
SELECT category, name, quantity_total, quantity_ready, storage_location, notes
FROM (
  VALUES
    ('Ballons', 'Ballons de match', 12, 10, 'Armoire principale', 'Verifier la pression avant chaque dimanche'),
    ('Chasubles', 'Chasubles vertes', 18, 16, 'Sac textile A', 'Lot principal pour Team A'),
    ('Chasubles', 'Chasubles rouges', 18, 17, 'Sac textile B', 'Lot principal pour Team B'),
    ('Cones', 'Coupelles d''echauffement', 40, 35, 'Caisse terrain', 'Pour ateliers et delimitation'),
    ('Arbitrage', 'Sifflets', 3, 3, 'Boite coach', 'Un reserve inclus'),
    ('Entretien', 'Pompes + aiguilles', 2, 2, 'Armoire principale', 'Controle hebdomadaire recommande'),
    ('Sante', 'Trousse de secours', 1, 1, 'Sac medical', 'Verifier le reapprovisionnement mensuel'),
    ('Recuperation', 'Glaciere + poches de glace', 1, 1, 'Local materiel', 'Utilise pour les petits bobos')
) AS seed(category, name, quantity_total, quantity_ready, storage_location, notes)
WHERE NOT EXISTS (SELECT 1 FROM inventory_items);