# SecurAssure - Gestion de clients mutuelle

Application web Node.js/Express pour gerer des clients mutuelle avec une
hierarchie multi-centres: super administrateur, administrateurs de centre et
agents. Le super administrateur gere tous les centres. Chaque administrateur de
centre gere uniquement ses agents et ses clients.

## Fonctionnalites

- Authentification JWT avec roles `SUPER_ADMIN`, `ADMIN` et `AGENT`
- Gestion multi-centres: un admin par centre, puis ses agents
- Dashboard administrateur: statistiques, liste clients, utilisateurs, import Excel/CSV
- Dashboard agent: clients assignes, recherche, filtre, tri, statut et notes
- Import Excel/CSV avec validation ligne par ligne
- Assignation manuelle ou aleatoire des clients aux agents
- Journalisation des imports et des actions clients, consultable par l'admin
- Limitation des tentatives de login et des appels API
- Limite d'upload a 5 MB et controle des types de fichiers d'import
- Base PostgreSQL avec migration et donnees de demarrage
- Frontend HTML/CSS/JavaScript statique

## Prerequis

- Node.js 18+
- npm
- PostgreSQL 12+

## Installation locale

```bash
npm install
copy .env.example .env
npm run db:migrate
npm start
```

L'application sert le frontend et l'API depuis le meme serveur:

- Interface: `http://localhost:5000`
- API: `http://localhost:5000/api`
- Sante API: `http://localhost:5000/api/health`

## Variables d'environnement

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lead_management
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key_here_change_in_production
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5000
```

En production, `DATABASE_URL` peut remplacer les variables `DB_*`.
`JWT_SECRET` est obligatoire en production.

## Compte cree par la migration

- Super admin: `admin@test.com` / `admin123`

Change ces identifiants avant toute mise en production.

## Organisation multi-centres

- `SUPER_ADMIN`: voit tous les centres, cree les admins de centre et peut creer
  des agents en choisissant un centre.
- `ADMIN`: voit uniquement son centre, cree uniquement des agents rattaches a ce
  centre, importe les clients de ce centre et assigne ces clients a ses agents.
- `AGENT`: voit uniquement les clients qui lui sont assignes.

Dans l'interface admin, `admin@test.com` est le super admin. Pour creer un
centre, il suffit de creer un utilisateur avec le role `Admin de centre` et de
renseigner le nom du centre. Ensuite cet admin de centre peut se connecter et
creer ses propres agents.

## Format Excel/CSV attendu

Colonnes acceptees:

- `nom`
- `prenom`
- `adresse`
- `ville`
- `code_postal`
- `nom_mutuelle`
- `prix_mutuelle`
- `status`
- `notes`

Les variantes avec majuscules ou libelles comme `Nom`, `Prenom`,
`Code postal`, `Nom mutuelle` et `Prix mutuelle` sont aussi prises en charge.

L'import accepte `.xlsx`, `.xls` et `.csv`, avec une limite de 5 MB et 5000
lignes par fichier.

## Scripts

```bash
npm start          # demarre le serveur Express
npm run dev        # demarre avec nodemon
npm run db:migrate # cree les tables et insere les donnees de test
npm run check      # verifie la syntaxe des fichiers backend principaux
npm test           # execute les tests Node
```

## API principale

### Authentification

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`

L'inscription publique cree uniquement des agents. La creation d'un utilisateur
admin necessite un JWT admin.

### Utilisateurs

- `GET /api/users`
- `GET /api/users/centers`
- `GET /api/users/:id`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### Clients

- `GET /api/clients`
- `GET /api/clients/me`
- `GET /api/clients/search?q=...`
- `GET /api/clients/:id`
- `POST /api/clients`
- `PUT /api/clients/:id`
- `DELETE /api/clients/:id`
- `PUT /api/clients/:id/assign`
- `POST /api/clients/assign-random`
- `POST /api/clients/import`

### Journal admin

- `GET /api/logs/imports`
- `GET /api/logs/audit`

Les routes de logs sont reservees aux administrateurs.

Les anciennes routes `/api/leads` existent encore dans le code, mais le frontend
actuel utilise `/api/clients`.

## Deploiement

Le fichier `vercel.json` configure:

- les routes `/api/*` vers `backend/server.js`
- les fichiers statiques depuis `frontend/public`

Avant deploiement, renseigner au minimum:

- `DATABASE_URL`
- `JWT_SECRET`
- `NODE_ENV=production`
- `FRONTEND_URL`

La migration PostgreSQL doit etre executee sur la base cible avant l'ouverture de
l'application.
