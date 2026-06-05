# Configuration SMS et WhatsApp

## Ce qui est livre dans l'application

- Le bouton WhatsApp ne sort plus vers `wa.me`: tout reste dans la fiche.
- L'agent envoie un message texte ou une piece jointe depuis l'UI: image, vocal/audio, video ou document.
- Le backend appelle WhatsApp Cloud API Meta quand les variables `WHATSAPP_*` sont configurees.
- Les messages entrants, statuts de livraison et medias recus arrivent par webhook dans `communication_messages`.
- Les fiches fermees restent en lecture seule pour les agents: pas d'envoi, pas d'ajout manuel, pas d'enregistrement.

## WhatsApp Cloud API Meta

Variables a configurer dans `.env`:

```env
WHATSAPP_API_BASE_URL=https://graph.facebook.com
WHATSAPP_API_VERSION=v20.0
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_VERIFY_TOKEN=un_token_secret_a_choisir
```

Webhook public a declarer chez Meta:

```text
https://votre-domaine.com/api/whatsapp/webhook
```

Champs webhook a souscrire:

- `messages` pour recevoir les messages entrants.
- `message_status` ou les statuts equivalents disponibles dans votre tableau de bord Meta pour recevoir `sent`, `delivered`, `read`, `failed`.

Parcours de mise en service:

1. Creer ou utiliser un Business Manager Meta verifie.
2. Creer une app Meta avec le produit WhatsApp.
3. Ajouter ou connecter un numero WhatsApp Business.
4. Recuperer le `Phone Number ID` et generer un access token permanent via un utilisateur systeme Business.
5. Renseigner les variables `.env`.
6. Configurer le webhook public HTTPS ci-dessus avec le meme `WHATSAPP_VERIFY_TOKEN`.
7. Redemarrer le serveur puis tester un envoi depuis une fiche non fermee.

Si `WHATSAPP_ACCESS_TOKEN` ou `WHATSAPP_PHONE_NUMBER_ID` manque, l'application garde le message avec le statut `PREPARED`. C'est volontaire: l'historique reste propre, mais aucun message reel n'est envoye.

## Medias WhatsApp

L'UI gere:

- Image: apercu dans la conversation.
- Vocal/audio: lecteur audio.
- Video: lecteur video.
- Document: lien de telechargement.

Les medias entrants sont telecharges depuis Meta a la demande via:

```text
GET /api/whatsapp/media/:mediaId
```

Cette route est protegee par le token utilisateur de l'application.

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

1. Choisir un provider qui vend des numeros francais et expose une API: Twilio, Vonage, Ringover, Aircall, Bird, etc.
2. Verifier avant achat que le numero +33 supporte les usages necessaires: SMS sortant, SMS entrant, voix, WhatsApp Business si besoin.
3. Acheter un numero par agent ou par equipe selon la logique commerciale.
4. Mettre le numero dans la fiche utilisateur admin.
5. Pour WhatsApp, connecter le numero dans Meta Business ou chez le provider choisi avant de l'utiliser.
