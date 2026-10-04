# Mise en production — Lumen Books

Site en ligne : **https://lumen-books-852.netlify.app**

Dépôt : `github.com/siddis100/lumen-books` (public, `main`)
Base : Supabase projet `imkxxglvioxggzldylgh` (eu-central-1)

Déploiement continu actif : chaque `git push` sur `main` redéploie le site.
Redéploiement manuel sans commit : `POST https://api.netlify.com/build_hooks/6abf92da9cc359185898718e`

---

## 1. Bloquant — avant le moindre encaissement

### 1.1 Supabase → Authentication → confirmation d'e-mail

`src/app/actions/auth.ts` suppose que la confirmation d'e-mail est activée.
Sinon quelqu'un peut créer un compte avec l'**e-mail d'un acheteur invité** et
récupérer le livre dans sa bibliothèque.

*Supabase → Authentication → Providers → Email → "Confirm email" ON.*

### 1.2 Fichiers PDF réels

Aucun livre n'a de PDF : le checkout échoue en `book_no_file`
(`src/lib/orders.ts:184`). Aucun livre n'est donc vendable en l'état.

Pour chaque livre : `/<locale>/admin/books` → téléverser le PDF + la couverture,
puis **publier** (l'import crée des brouillons `isActive: false`, `priceCents: 0`).

### 1.3 PayPal — vraies clés

Les variables actuelles sont des placeholders et `PAYPAL_ENV=sandbox`.

| Variable | Action |
|---|---|
| `PAYPAL_CLIENT_ID` | identifiant client (REST apps) |
| `PAYPAL_CLIENT_SECRET` | secret |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | **doit être identique** à `PAYPAL_CLIENT_ID` |
| `PAYPAL_WEBHOOK_ID` | ID du webhook (obligatoire : sans lui le webhook répond 401, fail-closed) |
| `PAYPAL_ENV` | `live` |
| `NEXT_PUBLIC_PAYPAL_ENV` | `live` |

Le webhook doit pointer vers `https://lumen-books-852.netlify.app/api/paypal/webhook`
et subscribed aux événements `PAYMENT.CAPTURE.COMPLETED` et `PAYMENT.CAPTURE.DENIED`.

### 1.4 Resend — l'email qui porte les liens de téléchargement

**Bloquant.** Un paiement peut être encaissé sans qu'aucun email ne parte : c'est
exactement ce qui s'est produit sur `LB-261004-2193E6`, payée et confirmée, aucun
email reçu. L'email reste la copie durable d'un achat, mais il n'est plus le seul
accès au fichier : voir les deux canaux de secours plus bas.

Les valeurs actuelles sont les placeholders de `.env.example` :

| Variable | Actuel | Action |
|---|---|---|
| `RESEND_API_KEY` | `re_xxx` | clé API réelle (Resend → API Keys) |
| `EMAIL_FROM` | `orders@yourdomain.com` | expéditeur sur un domaine **vérifié** |
| `CONTACT_EMAIL` | `support@yourdomain.com` | adresse de contact réelle |

Deux chemins, du plus rapide au plus propre :

1. **Domaine d'onboarding Resend** — `EMAIL_FROM = "Lumen Books <onboarding@resend.dev>"`.
   Aucun DNS à poser, mais Resend n'autorise l'envoi **que vers l'adresse du
   compte Resend**. Suffisant pour valider la chaîne de bout en bout, pas pour
   vendre.
2. **Domaine vérifié** — ajouter `lumenbooks.store` dans Resend → Domains, poser
   les enregistrements DNS qu'il donne (SPF, DKIM, éventuellement DMARC), attendre
   le statut `verified`, puis `EMAIL_FROM = "Lumen Books <orders@lumenbooks.store>"`.
   C'est l'option à retenir avant le lancement.

`node scripts/check-env.mjs` refuse désormais de laisser passer un `RESEND_API_KEY`
ou un `EMAIL_FROM` qui contient encore un token de `.env.example` : ces trois
variables sont marquées `critical` et font sortir le script en code 1.

Vérifier que l'email part vraiment : dans Resend → Emails, l'envoi doit apparaître
avec le statut `delivered`. Un `emailedAt` renseigné en base ne prouve **rien**,
le marqueur est posé avant l'appel à Resend et relâché si l'envoi échoue.

#### Vérifier la configuration sans logger dans l'UI

`GET /api/health` reste une sonde de vivacité, mais il répond aussi si la boutique
peut réellement servir un invité. Un booléen par réglage, jamais une valeur :

```bash
curl https://lumen-books-852.netlify.app/api/health
```

```json
{"status":"ok","config":{"emailSender":true,"emailApiKey":true,"paypalWebhook":true,"publicOrigin":true},"guestCheckoutReady":true}
```

`guestCheckoutReady` est le seul à surveiller : il résume les quatre réglages qui
font qu'un invité peut être servi. C'est le contrôle qui remplace le fait de
découvrir le problème après un paiement.

#### Les deux canaux qui survivent à un email cassé

Un invité n'a pas de compte de repli. Depuis le correctif, la livraison ne dépend
plus de la boîte de réception, et aucun des trois canaux ne dépend des deux
autres :

1. **La page de confirmation elle-même** (`/checkout/success?order=…&token=…`)
   affiche les liens signés dès que le webhook a confirmé la commande. Le client
   paie, il clique, il a ses fichiers : l'email n'est plus sur le chemin critique.
2. **La page `/<locale>/recover`**, accessible depuis le pied de page, la FAQ et la
   page de confirmation. Numéro de commande + adresse email suffisent à régénérer
   les liens à la volée. Limité à 10 tentatives par IP et par heure, et un numéro
   de commande sans correspondance répond `404 order_not_found` quel que soit
   l'email saisi : la page ne peut pas servir à découvrir qui a acheté quoi.
3. **L'email**, copie durable, la seule qui survit à un client qui vide sa boîte.

Les liens des trois canaux portent le même jeton HMAC et expirent au bout de
7 jours. Ils ne sont émis que pour les commandes invité : une commande rattachée
à un compte reste servie par la bibliothèque, et `/recover` répond
`409 use_account` pour l'orienter vers la connexion.

**Conséquence directe : `NEXT_PUBLIC_SITE_URL` devient bloquant.** Les liens
signés sont des URL absolues construites à partir de cette variable. Laissée sur
`http://localhost:3000`, tous les boutons « Télécharger » de la page de
confirmation et de `/recover` pointent vers la machine du visiteur : le paiement
fonctionne, la livraison non. Elle doit valoir
`https://lumen-books-852.netlify.app` (puis l'origine réelle avec le domaine),
sans barre oblique finale. C'est aussi le booléen `publicOrigin` de `/api/health`.

#### Reprise automatique

`src/app/api/cron/resend-confirmations` rattrape ce que le webhook n'a pas pu
envoyer. Le webhook ne s'exécute qu'une fois : si Resend refuse l'envoi (clé
expirée, expéditeur non vérifié, panne du fournisseur), la commande revient dans
la file et plus rien ne la reprend, sinon un client payé reste sans son livre.

`emailedAt IS NULL` sur une commande confirmée par le webhook *est* la file :
payée, confirmée, non livrée. L'endpoint réessaie par lot de 25, plus anciennes
d'abord, et reprend exactement le même verrou conditionnel que le webhook — un
rejeu concurrent ne peut donc pas produire de doublon.

Programmé toutes les 15 minutes dans `netlify.toml`. Le plan gratuit Netlify
n'autorise que les exécutions quotidiennes : dans ce cas, augmenter l'intervalle
ou déclencher à la main avec :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://lumen-books-852.netlify.app/api/cron/resend-confirmations
```

La réponse JSON indique `pending`, `sent` et `failed`. Un `failed` non vide
signale un expéditeur encore mal configuré : c'est un problème de configuration,
pas de Tentative.

Pour une commande précise, en local :
`npx tsx --conditions=react-server scripts/retry-confirmation-email.ts --order LB-…  --apply`

---

## 2. Obligatoire — conformité légale

Pages légales alimentées par les variables `SELLER_*`. Seule `SELLER_COUNTRY=Algeria`
est posée, les 7 autres manquent : la boutique ne peut pas être operée légalement.

| Variable | Contenu attendu |
|---|---|
| `SELLER_NAME` | nom commercial |
| `SELLER_LEGAL_NAME` | nom légal / raison sociale |
| `SELLER_KIND` | statut juridique (`individual`, `company`…) |
| `SELLER_ADDRESS` | adresse postale complète |
| `SELLER_VAT` | numéro de TVA si assujetti |
| `SELLER_REGISTRY` | RCS / registre de commerce |
| `SELLER_GOVERNING_LAW` | juridiction et droit applicable |

Pour l'Algérie : obligation d'indiquer l'identité de l'éditeur, l'adresse
professionnelle et le numéro d'enregistrement, et prix hors taxes.

---

## 3. Rotation des secrets exposés

Ces valeurs ont été imprimées en clair dans une session de travail. À régénérer,
puis à me communiquer pour que je les propage sur Netlify et `.env.local`.

- [ ] Mot de passe Postgres — *Supabase → Settings → Database → Reset password*
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — *Supabase → Settings → API Keys → Regenerate*

Déjà fait : `CRON_SECRET` et `DOWNLOAD_LINK_SECRET` (64 caractères, non affichés).

`KEYDATA.txt` est sur le disque mais ignoré par git. Ne jamais faire `git add -f`.

---

## 4. Optionnel — domaine

`lumenbooks.store` chez Namecheap ($0,98 la première année).
*Domain settings* sur Netlify → ajouter le domaine → afficher les enregistrements DNS
demandés. Le SSL est émis automatiquement.
Sans domaine, le site reste accessible uniquement sur `*.netlify.app`.

---

## 5. Dette technique connue

- `/api/cron/expire-links` est documenté dans `.env.example` mais n'a jamais été écrit.
  `listOrdersAwaitingWebhook` (`src/lib/orders.ts:361`) est du code mort.
- `src/app/api/health/route.ts` renvoie `{status, config, guestCheckoutReady}`.
  Utile en préproduction ; àrestrict à un accès interne avant l'ouverture.
- Un build local `netlify deploy` échoue sous Windows (bug OpenNext). Les builds
  distants Netlify (Linux) fonctionnent — c'est le chemin utilisé.
