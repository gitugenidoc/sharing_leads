# API Contract

Base URL :

```text
/api/v1
```

## Public

### POST `/auth/bootstrap`

Creation du premier admin si aucun user n'existe.

### POST `/auth/login`

Connexion et retour du token JWT.

### POST `/telephony/webhooks/snaptel`

Webhook entrant Snaptel.

## Protected

Header :

```text
Authorization: Bearer <token>
```

### GET `/auth/me`

### GET `/dashboard/summary`

### GET `/leads`

### POST `/leads`

### GET `/leads/:leadId`

### PATCH `/leads/:leadId/status`

### GET `/contacts`

### POST `/contacts`

### GET `/contacts/:contactId`

### PATCH `/contacts/:contactId`

### GET `/pipeline/summary`

Retourne toutes les étapes du pipeline dans l'ordre métier, y compris avec compteurs à `0` quand la base est vide.

### GET `/tasks`

### POST `/tasks`

### PATCH `/tasks/:taskId/status`

### GET `/visits`

### POST `/visits`

### POST `/visits/:visitId/check-in`

### POST `/visits/:visitId/check-out`

### GET `/activities`

### GET `/notifications`

### POST `/notifications/:notificationId/read`

### POST `/telephony/campaign-call`

### GET `/telephony/events`
