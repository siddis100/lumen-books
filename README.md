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
| `npm run typecheck` | vérification de types seule |
| `npm run check` | i18n:check + typecheck + build, la porte à passer avant un push |
| `npm run i18n:check` | vérifie que `en`, `fr` et `ar` ont exactement les mêmes clés |
| `npm run lint` | ESLint |
| `npm run env:check` | dit quelles variables manquent **sans jamais afficher de valeur** |
| `npm run db:probe` | teste la connexion Postgres (lecture seule) et dit si la migration est à appliquer |
| `npm run db:migrate` | plan de migration (dry run) — ajouter `-- --apply` pour l'exécuter |
| `npm run db:seed` | migration + `db/seed.sql` (démo) — ajouter `-- --apply` pour l'exécuter |

Le build **réussit même sans aucune variable d'environnement** : les pages
restent rendues et le catalogue se dégrade en « vide mais fonctionnel ». Un
déploiement Vercel ne peut donc jamais échouer pour cause de clé manquante.

---

## Mise en ligne, dans cet ordre

### 1. Supabase — https://supabase.com/dashboard

Créer un projet, puis appliquer le schéma. Deux chemins possibles :

- **Automatique** — renseigner `DATABASE_URL`, puis `npm run db:seed -- --apply`.
  Tout tourne dans une seule transaction : soit les tables, index, policies RLS
  et buckets existent, soit rien n'a été créé. La commande refuse de tourner si
  une table `orders` existe déjà.
- **Manuel** — dans l'éditeur SQL, exécuter **dans l'ordre** :
  `db/migrations/0000_init.sql` puis `db/seed.sql`. Les deux fichiers sont du
  SQL standard, sans méta-commande `psql`.

`db/seed.sql` contient 5 catégories, 12 livres de démonstration et le code promo
`WELCOME10`. Idempotent (`on conflict do nothing`), donc sans risque.

Récupérer ensuite `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` et `DATABASE_URL`
(*Project Settings → Data → Connection string*, mode **transaction pooler**
port 6543 pour l'application, **session pooler** port 5432 pour les migrations).

> `NEXT_PUBLIC_SUPABASE_URL` est indispensable **en plus** de `SUPABASE_URL` :
> c'est elle que le navigateur lit pour l'authentification. Les deux doivent être
> renseignées, avec la même valeur.
>
> `DATABASE_URL` doit avoir la région réellement remplacée : le modèle contient
> `aws-0-REGION.pooler.supabase.com`, et `REGION` est à substituer par le nom de
> votre région (`eu-central-1`, `us-east-1`…). Le mot de passe doit être encodé
> pour une URL.

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

Pousser le dépôt sur GitHub, puis importer le projet sur Vercel. Reporter
**toutes** les clés de `.env.example` dans *Settings → Environment Variables*,
avec `NEXT_PUBLIC_SITE_URL` sur le domaine définitif (sans slash final).

Ordre d Importance dans Vercel :

| Variable | Pourquoi |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | URL canonique, `sitemap.xml`, `robots.txt`, redirections PayPal |
| `DATABASE_URL` | sans elle le catalogue est vide |
| `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sans elles : ni connexion, ni PDF |
| `ADMIN_EMAILS` | rôle admin au premier sign-in |
| `CRON_SECRET` ou `DOWNLOAD_LINK_SECRET` | sans secret, les liens de téléchargement invité ne sont pas signés |
| `PAYPAL_*` / `NEXT_PUBLIC_PAYPAL_*` | sans elles, le bouton PayPal n'apparaît pas |
| `RESEND_API_KEY`, `EMAIL_FROM`, `CONTACT_EMAIL` | sans elles, aucun e-mail ne part |

Déployer une première fois, puis créer le webhook PayPal :

- URL : `https://<domaine>/api/paypal/webhook`
- événement : `PAYMENT.CAPTURE.COMPLETED`
- copier l'ID affiché dans `PAYPAL_WEBHOOK_ID`, puis **redéployer** (les
  variables sont lues au démarrage de la fonction)

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
scripts/
├── check-env.mjs              variables manquantes, sans afficher les valeurs
├── probe-db.mjs               connexion Postgres en lecture seule
├── migrate.mjs                applique le SQL (--apply, --seed)
├── i18n-audit.mjs             parité des clés entre en / fr / ar
└── patch-messages.mjs         ajout de clés i18n dans les 3 locales
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
