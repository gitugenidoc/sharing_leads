# Configuration SMS et WhatsApp

## Ce qui est livre dans l'application

- Chaque agent peut avoir trois numeros dans l'admin: telephone agent, numero SMS sortant, numero WhatsApp Business.
- Le bouton SMS prepare un SMS local par defaut. Si `SMS_SEND_MODE=provider`, le backend envoie le SMS via le provider configure.
- Le bouton WhatsApp ouvre `wa.me` avec le message pre-rempli et enregistre le message sortant dans l'historique WhatsApp.
- La fiche client contient un historique WhatsApp separe, avec ajout manuel des messages recus.

## Envoi SMS reel avec Twilio

Variables a configurer:

```env
SMS_SEND_MODE=provider
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
```

Ensuite, dans l'admin:

1. Acheter ou porter un numero compatible SMS.
2. Renseigner ce numero dans "Numero SMS sortant" pour chaque agent.
3. Tester avec un seul agent avant d'activer tous les comptes.

Le backend appelle l'API Twilio Messages sans package supplementaire. Si le provider echoue, l'action est enregistree avec le statut `FAILED` dans `communication_messages`.

## Acheter un numero +33 par agent

Parcours recommande:

1. Choisir un provider SMS/voix qui vend des numeros francais et expose une API: Twilio, Vonage, Ringover, Aircall, MessageBird/Bird, etc.
2. Verifier avant achat que le numero +33 supporte bien les usages necessaires: SMS sortant, SMS entrant, voix, WhatsApp Business si besoin.
3. Acheter un numero par agent ou par equipe selon votre logique commerciale.
4. Mettre le numero dans la fiche utilisateur admin.
5. Configurer les webhooks entrants du provider vers une future route inbound pour remplir automatiquement `communication_messages`.

## WhatsApp

`wa.me` ne donne pas une vraie boite de reception API. Il ouvre WhatsApp avec un message pre-rempli. Pour recevoir automatiquement les messages entrants dans l'application, il faut utiliser WhatsApp Business Platform via Meta ou un provider comme Twilio, puis connecter les webhooks entrants a `communication_messages`.

Le modele de donnees est deja pret:

- `channel`: `SMS` ou `WHATSAPP`
- `direction`: `OUTBOUND` ou `INBOUND`
- `status`: `PREPARED`, `SENT`, `FAILED`, etc.
- `provider` et `provider_message_id`
- `raw_payload` pour stocker la reponse brute du provider
