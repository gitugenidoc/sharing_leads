# Architecture

## Cible

Application mobile de force commerciale terrain avec backend centralise.

Objectifs :

- suivi des leads terrain
- ouverture rapide de la fiche prospect
- pipeline commercial
- taches et visites
- telephonie reliee aux leads

## Front mobile

Flutter, structure par couches :

- `models/`
- `services/`
- `data/`
- `screens/`
- `widgets/`

Ecrans :

- setup / login
- dashboard
- leads
- fiche lead
- contacts
- pipeline

## Backend

Node.js + Express + Prisma.

Domaines exposes :

- auth
- dashboard
- leads
- contacts
- pipeline
- tasks
- visits
- activities
- notifications
- telephony

## Base de donnees

PostgreSQL vide au depart.

Pipeline commercial retenu :

1. Nouveau Lead
2. Qualification
3. Premier Contact
4. Analyse du Besoin
5. Opportunité
6. Proposition
7. Négociation
8. Gagné ou Perdu
9. Onboarding
10. Fidélisation

Note :

- `Gagné` et `Perdu` sont stockés comme deux étapes distinctes dans la base
- `Onboarding` et `Fidélisation` s'appliquent en pratique après `Gagné`

Le schema Prisma couvre :

- users
- leads
- contacts
- tasks
- visits
- activities
- call events
- notifications

## Telephonie

Flux entrant :

1. Snaptel appelle le webhook backend
2. le backend verifie le secret
3. le backend tente le matching par numero
4. le backend cree un `call_event`
5. le backend cree une notification agent si un agent est rattache

Flux sortant :

1. l'agent declenche un appel
2. le backend cree un `call_event`
3. le backend appelle le webhook de campagne Snaptel si configure

## Initialisation

La base etant vide :

1. lancer Postgres
2. appliquer le schema Prisma
3. ouvrir l'app mobile
4. creer le premier admin depuis l'ecran setup
5. commencer a creer leads, contacts et actions
