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

- `orders.paypal_payer_email` (SQL) vs `"payer_email"` (Drizzle, `src/lib/db/schema.ts:151`)
  — toute lecture de cette colonne échoue. À aligner avant la première vente.
- `rating_avg numeric(5,2)` (SQL) vs `numeric(3,2)` (Drizzle).
- `/api/cron/expire-links` est documenté dans `.env.example` mais n'a jamais été écrit.
  `listOrdersAwaitingWebhook` (`src/lib/orders.ts:361`) est du code mort.
- `src/app/api/health/route.ts` ne renvoie que `{status}` ; à supprimer en production.
- Un build local `netlify deploy` échoue sous Windows (bug OpenNext). Les builds
  distants Netlify (Linux) fonctionnent — c'est le chemin utilisé.
