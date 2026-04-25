# CAMAS e.V. Sport App

Application web pour la gestion des présences, équipes et amendes du club CAMAS e.V.

## Fonctionnalités principales
- Vote de présence pour les matchs
- Calcul automatique des amendes de retard
- Génération des équipes selon le nombre d’inscrits
- Suivi de la caisse et des dépenses

## Structure du projet
- `frontend/` : Application React (Vite)
- `backend/` : API Node.js (Express, NeonDB)

## Démarrage rapide

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Variables d’environnement
Créer un fichier `.env` dans `backend/` :
```
PORT=3000
DATABASE_URL=ici_on_collera_le_lien_de_ta_base_neon
```

## Déploiement
- Dépôt GitHub : https://github.com/samueldev-del/camas-sport-app.git

---

© CAMAS e.V. 2026