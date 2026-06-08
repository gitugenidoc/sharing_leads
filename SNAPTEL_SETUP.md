# Integration Snaptel

Endpoint public a configurer dans Snaptel:

`https://votre-domaine.com/api/snaptel/webhook`

Secret recommande:

- Header: `x-snaptel-secret: <SNAPTEL_WEBHOOK_SECRET>`
- Alternative acceptee: `Authorization: Bearer <SNAPTEL_WEBHOOK_SECRET>`

Ce que fait le webhook:

- accepte les evenements d'appel Snaptel en `POST`
- tente de retrouver le client par numero (`tel_gsm`, `tel_fixe`, `tel_professionnel`)
- enregistre l'evenement dans `communication_messages` avec `channel=CALL`
- ajoute une entree `SNAPTEL_CALL_EVENT` dans l'historique du client si un client est retrouve

Variables d'environnement:

- `SNAPTEL_WEBHOOK_SECRET`: secret partage pour proteger le webhook

Verification rapide:

`GET /api/snaptel/webhook`

si `SNAPTEL_WEBHOOK_SECRET` est configure, il faut fournir le secret aussi sur le `GET`.

Exemple de payload supporte:

```json
{
  "event": "call.completed",
  "direction": "inbound",
  "call": {
    "id": "call_123",
    "from": "+212600000000",
    "to": "+212500000000",
    "duration": 184
  },
  "campaign": {
    "id": "cmp_123",
    "name": "Mutuelle FR"
  },
  "summary": "Prospect interesse, rappel demande demain matin."
}
```

Remarque sur le trunk SIP:

- ce projet n'expose pas de trunk SIP sortant natif
- pour un test complet Snaptel, il faudra brancher un trunk SIP/PBX existant cote telephonie
- le backend ici prepare surtout la reception et la trace des evenements d'appel
