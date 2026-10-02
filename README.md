# Lumen Books

Boutique de livres numériques. Next.js 16 (App Router) + next-intl (EN / FR / AR),
Drizzle + Supabase (Postgres + Auth + Storage), paiement PayPal, e-mails Resend.

L'historique complet des décisions est dans [`LOG.md`](./LOG.md), étape par étape.

---

## Démarrage local

```bash
npm install
cp .env.example .env.local   # puis remplir les clés
npm run dev                  # http://localhost:3000
```

| Commande | Rôle |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm run build` | build de production (génère aussi les types de routes) |
| `npx tsc --noEmit -p tsconfig.json` | vérification de types seule |
| `npm run lint` | ESLint |

---

## Mise en ligne, dans cet ordre

### 1. Supabase — https://supabase.com/dashboard

Créer un projet, puis dans l'éditeur SQL exécuter **dans l'ordre** :

1. `db/migrations/0000_init.sql` — schéma, RLS, buckets `covers` (public) et
   `pdfs` (privé).
2. `db/seed.sql` — 5 catégories, 12 livres de démonstration et le code promo
   `WELCOME10`. Idempotent (`on conflict do nothing`), donc sans risque.

Récupérer ensuite `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` et `DATABASE_URL`
(*Project Settings → Data → Connection string*, mode **transaction pooler**
port 6543 pour l'application, **session pooler** port 5432 pour les migrations).

### 2. Resend — https://resend.com/api-keys

Créer une clé API, vérifier le domaine d'envoi, renseigner `RESEND_API_KEY`,
`EMAIL_FROM` et `CONTACT_EMAIL`.

### 3. PayPal — https://developer.paypal.com/dashboard/applications

Créer une application **Sandbox** et relever *Client ID* et *Secret*.
Les reporter dans `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
`NEXT_PUBLIC_PAYPAL_CLIENT_ID` (même valeur) et `PAYPAL_ENV=sandbox`.

Le `PAYPAL_WEBHOOK_ID` se crée **après** le déploiement, car le webhook a
besoin d'une URL publique (étape 5).

### 4. Identité du vendeur

Renseigner `SELLER_NAME`, `SELLER_LEGAL_NAME`, `SELLER_KIND`,
`SELLER_ADDRESS`, `SELLER_VAT`, `SELLER_REGISTRY`, `SELLER_COUNTRY` et
`SELLER_GOVERNING_LAW`. Ces valeurs sont affichées en bas des pages
`/legal/terms`, `/legal/privacy` et `/legal/refund`. Un champ vide est
simplement non affiché — mais **adresse** et **droit applicable** sont
obligatoires avant d'encaisser de l'argent réel.

Déclarer `ADMIN_EMAILS` : ces adresses obtiennent le rôle admin au premier
connexion.

### 5. Déploiement — GitHub puis Vercel

Pousser le dépôt sur GitHub, importer le projet sur Vercel, reporter **toutes**
les clés de `.env.example` dans *Settings → Environment Variables*, puis
déployer. Mettre `NEXT_PUBLIC_SITE_URL` sur le domaine définitif.

Une fois le site en ligne, créer le webhook PayPal :

- URL : `https://<domaine>/api/paypal/webhook`
- événement : `PAYMENT.CAPTURE.COMPLETED`
- copier l'ID affiché dans `PAYPAL_WEBHOOK_ID`

Passer enfin `PAYPAL_ENV=live` et `NEXT_PUBLIC_PAYPAL_ENV=live` avec les clés
Live, une fois le compte PayPal validé.

### 6. Premier import

Se connecter en admin, aller dans **Import**, déposer les PDF. Chaque fichier
devient un brouillon inactif : on vérifie le titre et le prix, on publie. Un
livre sans PDF téléversé reste visible mais **refusé au checkout** — on ne
facture jamais un titre sans fichier.

---

## Arborescence

```
db/
├── migrations/0000_init.sql   schéma + RLS + buckets
└── seed.sql                   catalogue de démonstration
scripts/patch-messages.mjs    ajout de clés i18n dans les 3 locales
src/
├── app/
│   ├── [locale]/              pages publiques, compte client, admin
│   └── api/                   cart, checkout, paypal, webhooks, downloads…
├── components/                ui/ (shadcn) + account, admin, book, cart…
├── i18n/                      routing + request config
├── lib/
│   ├── admin/                 couche lecture admin + stockage
│   ├── db/                    drizzle + schémas
│   ├── queries/               couche lecture catalogue
│   ├── actions/               Server Actions (reviews, auth, admin)
│   └── auth, env, email, money, orders, paypal, seo, seller…
└── messages/{en,fr,ar}.json   toutes les traductions
```

---

## Modèle de sécurité, en une page

- **Le navigateur n'envoie jamais de prix.** Il envoie `{ bookId, quantity }` ;
  les totaux sont recalculés côté serveur depuis la table `books`.
- **Les téléchargements restent verrouillés** tant que le webhook PayPal signé
  n'a pas confirmé le paiement (`orders.webhook_confirmed_at`).
- **Les PDF vivent dans un bucket privé** et ne sortent que par une URL signée
  de 5 minutes, servie par `GET /api/downloads/[orderItemId]` après contrôle de
  propriété de la commande. Les invités reçoivent un lien HMAC valable 7 jours.
- **RLS active sur toutes les tables.** Les commandes n'ont aucune policy de
  lecture pour les utilisateurs : elles passent par Drizzle (service role).
- **Tous les endpoints sensibles sont rate-limités.**
