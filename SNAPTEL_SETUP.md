# Integration Snaptel + Infinivox

Endpoint public a configurer dans Snaptel:

`https://votre-domaine.com/api/snaptel/webhook`

Webhook de campagne Snaptel a configurer dans Vercel pour que ShareLeads declenche un appel via Snaptel, avec la voix transportee par Infinivox:

`SNAPTEL_CAMPAIGN_WEBHOOK_URL=https://snaptel-callback-v3.vercel.app/api/webhooks/campaigns/...`

Secret recommande:

- Header: `x-snaptel-secret: <SNAPTEL_WEBHOOK_SECRET>`
- Alternative acceptee: `Authorization: Bearer <SNAPTEL_WEBHOOK_SECRET>`

Ce que fait le webhook:

- accepte les evenements d'appel Snaptel en `POST`
- tente de retrouver le client par numero (`tel_gsm`, `tel_fixe`, `tel_professionnel`)
- enregistre l'evenement dans `communication_messages` avec `channel=CALL`
- ajoute une entree `SNAPTEL_CALL_EVENT` dans l'historique du client si un client est retrouve
- permet au front agent de rouvrir automatiquement la fiche prospect lors d'un nouvel appel detecte

Variables d'environnement:

- `SNAPTEL_WEBHOOK_SECRET`: secret partage pour proteger le webhook
- `SNAPTEL_CAMPAIGN_WEBHOOK_URL`: webhook de campagne Snaptel que ShareLeads appelle pour lancer l'appel
- `SNAPTEL_CAMPAIGN_WEBHOOK_SECRET`: secret optionnel a envoyer au webhook de campagne
- `SNAPTEL_CAMPAIGN_WEBHOOK_SECRET_HEADER`: nom du header secret, par defaut `x-snaptel-secret`
- `SNAPTEL_DATA_MODE`: `minimal` recommande. En `minimal`, ShareLeads n'envoie a Snaptel que les donnees utiles au declenchement d'appel. Passez en `full` seulement si vous avez un besoin metier explicite.

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

Flux reel apres integration:

1. L'agent clique sur `Appeler` dans ShareLeads.
2. Le backend appelle `SNAPTEL_CAMPAIGN_WEBHOOK_URL` avec un payload lead/agent minimal par defaut.
3. Snaptel declenche l'appel et le route via votre couche voix Infinivox.
4. Si Snaptel accepte la requete, ShareLeads n'ouvre plus `tel:` et considere l'appel envoye a Snaptel / Infinivox.
5. Snaptel renvoie ensuite ses evenements d'appel vers `https://votre-domaine.com/api/snaptel/webhook`.
6. Le front agent detecte le nouvel evenement et rouvre automatiquement la fiche prospect correspondante.

Mode `minimal` recommande vers Snaptel:

- `leadId`
- `phone`
- `firstName` / `lastName` / `fullName`
- `agentName` / `agentPhone`
- `centerId`
- metadata techniques

Ne pas envoyer a Snaptel sauf besoin explicite:

- `date_naissance`
- `adresse`
- `email`
- `nom_mutuelle`
- `prix_mutuelle`
- `notes`
- `besoins_specifiques`
