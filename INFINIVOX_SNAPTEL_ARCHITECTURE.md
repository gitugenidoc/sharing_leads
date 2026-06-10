## Architecture cible

Pour `ShareLeads`, la bonne separation est:

- `ShareLeads` = source de verite CRM et fiche prospect
- `Snaptel` = declenchement d'appel, event webhooks, contexte agent
- `Infinivox` = transport voix / trunk SIP / carrier

En pratique:

1. l'agent clique sur `Appeler` dans `ShareLeads`
2. `ShareLeads` poste un webhook vers `Snaptel`
3. `Snaptel` declenche l'appel via `Infinivox`
4. `Snaptel` renvoie les evenements d'appel a `ShareLeads`
5. `ShareLeads` rattache l'appel au prospect et rouvre la fiche cote agent

## Ce que Snaptel peut vous apporter

- click-to-call depuis webhook
- mapping `lead -> appel -> agent`
- event webhooks d'appel
- contexte d'appel cote interface agent
- journal d'appel exploitable
- routage vers le bon agent ou la bonne campagne

Si Snaptel le propose sur votre offre, vous pouvez aussi exploiter:

- affichage de fiche ou URL de screen-pop
- remontes de statuts temps reel
- enregistrement / transcription
- etiquettes campagne / source / agent

## Ce qu'il ne faut pas donner a Snaptel

Par defaut, ne partagez pas:

- date de naissance
- adresse complete
- email
- nom de mutuelle
- prix mutuelle
- notes internes
- besoins specifiques
- scores internes
- commentaires de validation

Le minimum utile pour declencher un appel est:

- `leadId`
- `phone`
- `fullName` ou `firstName` + `lastName`
- `agentName`
- `agentPhone`
- `centerId`
- metadata techniques (`callback_webhook_path`, source, campaign tag)

## Regles de securite recommandees

- laissez `SNAPTEL_DATA_MODE=minimal`
- utilisez un secret webhook fort avec rotation periodique
- n'acceptez que `HTTPS`
- activez une allowlist IP si Snaptel peut la fournir
- utilisez des identifiants techniques (`leadId`, `externalRef`) plutot que des donnees riches
- gardez la fiche complete uniquement dans `ShareLeads`
- n'activez enregistrement et transcription que si le besoin metier est reel
- fixez une retention courte pour les enregistrements et transcripts
- demandez DPA / clauses RGPD / sous-traitants / lieu d'hebergement
- journalisez tous les evenements entrants avec `callId`, `campaignId`, `timestamp`

## Recommandation pratique

Pour votre cas:

- `Snaptel` doit recevoir seulement le minimum necessaire au declenchement
- `Infinivox` doit etre le carrier voix derriere `Snaptel`
- la fiche prospect complete doit s'ouvrir depuis `ShareLeads`, pas etre reconstituee chez `Snaptel`
- `ShareLeads` doit rester le seul endroit ou vivent les donnees sensibles
