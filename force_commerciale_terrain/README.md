# Force Commerciale Terrain

Monorepo de demarrage pour une application mobile terrain en Flutter avec backend Node.js.

Cette version est volontairement :

- sans donnees de demo
- branchee sur une vraie API
- prevue pour une base PostgreSQL initialement vide

## Structure

```text
force_commerciale_terrain/
  backend/
  mobile_flutter/
```

## Backend

Stack :

- Node.js
- Express
- Prisma
- PostgreSQL
- JWT

Fonctions deja structurees :

- bootstrap admin initial
- login
- leads
- contacts
- pipeline
- tasks
- visits
- activities
- notifications
- telephony Snaptel

Pipeline commercial configure :

1. Nouveau Lead
2. Qualification
3. Premier Contact
4. Analyse du Besoin
5. Opportunité
6. Proposition
7. Négociation
8. Gagné / Perdu
9. Onboarding
10. Fidélisation

### Demarrage

```bash
cd backend
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Premiere utilisation :

1. la base est vide
2. l'app mobile ouvre l'ecran `Setup`
3. tu crees le premier admin
4. ensuite tu te connectes normalement

## Mobile Flutter

Le mobile est connecte a l'API et affiche des etats vides si la base n'a encore aucun contenu.

### Demarrage

```bash
cd mobile_flutter
flutter pub get
flutter run
```

URL API par defaut :

- Android emulator : `http://10.0.2.2:4100/api/v1`
- Desktop / iOS simulator : `http://localhost:4100/api/v1`

## Telephonie

Webhook entrant Snaptel :

- `POST /api/v1/telephony/webhooks/snaptel`

Appel sortant campagne :

- `POST /api/v1/telephony/campaign-call`

## Variables d'environnement backend

- `DATABASE_URL`
- `JWT_SECRET`
- `SNAPTEL_WEBHOOK_SECRET`
- `SNAPTEL_WEBHOOK_SECRET_HEADER`
- `SNAPTEL_CAMPAIGN_WEBHOOK_URL`
- `SNAPTEL_CAMPAIGN_WEBHOOK_SECRET`
- `SNAPTEL_CAMPAIGN_WEBHOOK_SECRET_HEADER`
