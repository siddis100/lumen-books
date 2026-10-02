# LOG — Lumen Books

Journal chronologique des actions. Une entrée par étape du plan.

Format : `## Étape N — titre` puis date, actions, points d'attention.

---

## Étape 1 — Initialisation du projet, charte graphique, composants UI

**Statut : terminée.**

### Actions

- **Création du projet** sur `D:\Lumen Books` via `create-next-app` (dossier créé sans
  espace puis renommé : npm interdit les espaces dans le nom de package, le package
  s'appelle donc `lumen-books`). Options : TypeScript, Tailwind v4, ESLint, App Router,
  dossier `src/`, alias `@/*`, Turbopack.
- **Versions** : Next.js `16.3.8`, React `19.2.8`, TypeScript, Tailwind CSS `v4`.
  Next 16 utilise désormais `src/proxy.ts` (ex-`middleware.ts`) — vérifié dans
  `next/dist/lib/constants.d.ts` (`PROXY_FILENAME`).
- **Dépendances ajoutées** :
  - données / auth : `drizzle-orm`, `postgres`, `@supabase/supabase-js`, `@supabase/ssr`
  - i18n : `next-intl`
  - paiement : `@paypal/react-paypal-js`
  - e-mail : `resend`
  - validation : `zod`
  - UI : `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`,
    `nuqs` (filtres de catalogue dans l'URL), `zustand` (panier persisté),
    `motion` (animations légères), `next-themes`, `sonner`, `vaul`, `cmdk`,
    `embla-carousel-react`, `radix-ui`, `tw-animate-css`
  - dev : `drizzle-kit`, `prettier`, `prettier-plugin-tailwindcss`
- **shadcn/ui** : CLI 4.21.1, base `radix`, preset `nova`, option RTL.
  Les requêtes vers `ui.shadcn.com` via la CLI expiraient (Connect Timeout) →
  téléchargement direct des JSON du registre via `Invoke-WebRequest`
  (`scripts/fetch-shadcn.ps1`, `scripts/fetch-shadcn2.ps1`), puis correction des
  imports (`scripts/fix-shadcn-imports.mjs` : `cn` → `@/lib/utils`,
  `@/registry/radix-nova/ui/*` → `@/components/ui/*`, icônes → shim local).
  **35 composants UI** disponibles dans `src/components/ui`.
  Composant `sidebar` supprimé (import cassé du registre, non utilisé).
- **Charte graphique** (`src/app/globals.css`) :
  - palette « papier » chaude (neutres crème) + accent ambre « lumen »
  - thèmes clair et sombre en `oklch`, jetons `--brand`, `--brand-foreground`, `--brand-muted`
  - rayon 0.75 rem, utilitaires `.font-display`, `.bg-grain`, `.book-cover-frame`,
    `.line-clamp-2/3`, `.prose-lb`, `.container-page`, `.rtl-flip`
  - lien d'évitement (skip link), réduction des animations selon
    `prefers-reduced-motion`, bascule de famille de police pour `:root[lang="ar"]`
- **Typographie** (`src/lib/fonts.ts`, auto-hébergée via `next/font`) :
  Inter (texte), **Fraunces** (titres, axes SOFT + WONK), Geist Mono (données),
  Noto Sans Arabic (arabe).
- **Structure du dépôt**

```
D:\Lumen Books
├── src
│   ├── app/[locale]/…        # layout racine + pages
│   ├── components/
│   │   ├── ui/               # shadcn/ui
│   │   ├── common/           # Container, Section, SectionHeading, EmptyState, Logo, RatingStars
│   │   ├── layout/           # header, footer, nav mobile, recherche, thème, langue, cookies
│   │   ├── book/ home/ marketing/
│   ├── i18n/                 # routing, navigation, request
│   ├── lib/                  # env, money, auth, paypal, db, supabase, schemas, queries
│   ├── messages/             # en.json, fr.json, ar.json
│   └── stores/               # panier (zustand)
├── db/migrations/0000_init.sql
├── scripts/
└── drizzle.config.ts
```

### Points d'attention

- Les boutons du registre shadcn ont des **hauteurs réduites** (`h-8` par défaut) :
  passer une classe `h-10` / `h-11` explicite pour l'échelle premium du design.
- `npm` doit être appelé via **`npm.cmd`** (politique d'exécution PowerShell).
- Les fichiers `.env*` sont protégés par EnvSitter dans cet environnement ;
  `.env.local` sera alimenté via les outils EnvSitter au moment des clés réelles.
- `publicEnv()` est volontairement tolérante : le build doit réussir avant
  l'injection des clés (elles sont injectées à l'exécution sur Vercel).

---

## Étape 2 — Schéma de base de données, authentification, stockage

**Statut : terminée (code + SQL prêts, à exécuter dans Supabase).**

### Choix d'ORM

**Drizzle ORM** — plus léger que Prisma (pas de moteur binaire, fonctionne derrière le
pooler Supabase en IPv4 comme sur Vercel), requêtes proches du SQL, et le meilleur
inférence TypeScript du marché.

### Actions

- **Schéma Drizzle** (`src/lib/db/schema.ts`) :
  `profiles`, `categories`, `books`, `orders`, `order_items`, `downloads`,
  `promo_codes`, `reviews`, `newsletter_subscribers`, `contact_messages`,
  `rate_limits`, `settings`. Relations + types exportés (`BookWithCategory`,
  `OrderWithItems`…).
- **Client Postgres** (`src/lib/db/index.ts`) : `postgres` + `drizzle`, cache sur
  `globalThis.__lumenDb__`, `prepare: false` (nécessaire avec le pooler en
  transaction). Exposé via un **Proxy paresseux** : l'import du module ne lève
  jamais d'exception, la connexion n'est ouverte qu'au premier usage — le build
  reste donc possible sans `DATABASE_URL`.
- **Migration SQL** (`db/migrations/0000_init.sql`, idempotente) :
  - types `user_role`, `order_status`, `review_status`, `promo_kind`
  - toutes les tables + index (dont un index GIN plein texte sur titre/auteur/ISBN)
  - triggers `updated_at`, `handle_new_user` (crée le profil à l'inscription et
    accorde le rôle admin aux e-mails de `app.settings.admin_emails`), `promote_admin()`,
    `refresh_book_rating()`
  - **RLS activée sur toutes les tables** : lecture publique limitée
    (`books.is_active`, catégories, avis approuvés), insertion d'avis par un
    utilisateur connecté à son propre nom, newsletter/contact en insertion anonyme ;
    `orders`, `order_items`, `downloads`, `promo_codes`, `rate_limits`, `settings`
    n'ont **aucune policy** → aucun accès direct depuis le navigateur.
  - **Stockage** : bucket `covers` public (4 Mo, images) et bucket `pdfs`
    **privé** (40 Mo, `application/pdf`, aucune policy de lecture) → les PDF ne
    sont atteignables que par URL signée temporaire émise par le serveur.
  - vue `sales_daily` pour les statistiques admin.
- **Auth** (`src/lib/auth.ts`, `src/lib/supabase/*`) : session par cookies
  (`@supabase/ssr`), `getSessionUser` (tolérant : `null` si Supabase non
  configuré), `requireUser` / `requireAdmin` (erreurs `UNAUTHENTICATED` /
  `FORBIDDEN`), `hasAnyAdmin`, client navigateur, client service-role réservé au
  serveur (`createSignedUrl(path, 300)`).
- **Sécurité transverse** : `src/lib/rate-limit.ts` (limitation par fenêtre fixe
  en base), `src/lib/env.ts` (validation Zod paresseuse), `src/lib/schemas.ts`
  (Zod pour tous les formulaires).
- **Paiement** (`src/lib/paypal.ts`) : cache du token OAuth, base d'API
  sandbox/live, `createPayPalOrder` (Orders v2, `currency_code: "USD"`,
  `NO_SHIPPING` / `PAY_NOW`, `breakdown` + articles `DIGITAL_GOODS`),
  `capturePayPalOrder` (en-tête `Prefer: return=representation`), `getPayPalOrder`,
  `refundPayPalCapture`, `verifyWebhookSignature`
  (`/v1/notifications/verify-webhook-signature`, exige `PAYPAL_WEBHOOK_ID`),
  `capturedAmountCents`, `isCaptureComplete`.
- **Argent** (`src/lib/money.ts`) : devise unique `USD`, `formatPrice` → `$12.99`
  (Intl `en-US`, 2 décimales), conversions cents ↔ PayPal, remise en pourcentage.
- **i18n** : `en` (défaut), `fr`, `ar` (RTL complet) ; 17 espaces de noms de
  messages traduits dans les trois langues ; `src/proxy.ts` combine le middleware
  next-intl et le rafraîchissement de session Supabase.

### Points d'attention

- Le serveur Next se connecte avec l'utilisateur propriétaire des tables
  (`postgres`), qui **contourne la RLS** : l'application garde tous les droits,
  et tout accès navigateur est restreint par les policies. Les écritures passent
  exclusivement par des server actions / route handlers validés par Zod.
- `PAYPAL_WEBHOOK_ID` est obligatoire en production : sans lui, la vérification de
  signature échoue et aucun téléchargement n'est débloqué.

---

## Étape 3 — Pages publiques et catalogue

**Statut : terminée.**

- `src/lib/queries/catalog.ts` : couche de lecture (catégories, best-sellers,
  nouveautés, fiche livre, livres similaires, avis, recherche, filtres/tri,
  pagination 12/page), chaque fonction protégée par `safe()` pour que les pages
  restent rendues même base hors ligne.
- Accueil (`src/app/[locale]/page.tsx`) : hero, best-sellers, catégories,
  nouveautés, arguments, avis, newsletter, appel à l'action.
- Catalogue (`src/app/[locale]/books/page.tsx`) : recherche, filtres catégorie /
  langue / prix / tri, pagination — tout dans l'URL via `nuqs`, la source de vérité
  restant la requête serveur. `parseQuery` convertit les dollars de l'URL en cents.
- Fiche livre (`src/app/[locale]/books/[slug]/page.tsx`) : buy box, ajout au panier
  avec quantité, description, extrait, spécifications, avis approuvés + formulaire
  (`src/app/actions/reviews.ts`, statut `pending` → modération admin), livres
  similaires, JSON-LD `Book` + `Product`, métadonnées OpenGraph Book.
- Pages statiques : About, Contact (formulaire → `/api/contact` → Resend), FAQ
  (accordéon avec recherche côté client), pages légales dynamiques
  `/legal/{terms,privacy,refund}`.
- SEO technique : `src/app/sitemap.ts` (URL x 3 langues avec `alternates.languages`),
  `src/app/robots.ts` (blocage `/api`, `/admin`, `/account`, `/checkout`, `/cart`),
  `src/app/[locale]/not-found.tsx` traduit.
- **Piège rencontré** : `scripts/patch-messages.mjs` écrasait le namespace `contact`
  (objet) avec une chaîne. Ajout d'une garde dans `mergeDeep` qui refuse de remplacer
  un objet par un scalaire, et restauration des 3 locales.
- Build vert : `npm.cmd run build` → 29 pages générées, 0 erreur TypeScript,
  0 `MISSING_MESSAGE`.
- **À compléter avant mise en ligne** : identité légale du vendeur (raison sociale,
  adresse, n° TVA, droit applicable) dans les pages légales — voir `LOG.md` étape 3.

---

## Étape 4 — Panier et paiement PayPal

**Statut : terminée (code prêt, à exécuter avec les clés PayPal).**

### Modèle de sécurité

Le navigateur n'envoie jamais de prix. Il envoie uniquement
`{ bookId, quantity }` + email + code promo + acceptation des conditions ;
tous les montants sont recalculés côté serveur à partir de la table `books`
(`src/lib/orders.ts`). Un panier falsifié dans `localStorage` ne change donc
rien au montant demandé à PayPal.

- `src/lib/orders.ts` (server-only) : `normalizeItems` (entiers, quantités 1–10,
  20 titres max, dédoublonnage), `pricePromo` (fenêtre de validité, `maxUses`,
  `minSubtotalCents`, % ou montant fixe borné au sous-total), `priceOrder`
  (relit le catalogue, rejette les livres inactifs ou supprimés),
  `newOrderNumber()` → `LB-AAAAMMJJ-XXXXXX`, `createPendingOrder` (transaction
  Drizzle : `orders` + `orderItems` avec snapshots titre/auteur/couverture/prix),
  `confirmOrderPayment` (**idempotent** : garde `status <> 'paid'`, ne touche
  plus `paidAt` si déjà réglé) et `toEmailOrder`.
- Les **téléchargements restent verrouillés** tant que `webhookConfirmedAt`
  est nul : seul le webhook signé `PAYMENT.CAPTURE.COMPLETED` débloque.

### Routes

| Route | Rôle |
| --- | --- |
| `POST /api/cart/price` | Tarifs autoritatifs du panier + validité du code promo (rate limit 60/min) |
| `POST /api/checkout` | Crée la commande `pending` + l'ordre PayPal, renvoie `approvalUrl` |
| `POST /api/paypal/capture` | Capture après retour de PayPal, compare le montant capturé |
| `POST /api/paypal/webhook` | Vérifie la signature, confirme le paiement |
| `GET /api/orders/status` | Polling de la page de succès (`downloadsReady`) |

- `POST /api/checkout` : `rateLimit("checkout", ip, 12, 3600)`, `getSessionUser`
  pour rattacher la commande au compte si connecté, `return_url` =
  `/{locale}/checkout/success?order=LB-…`, `cancel_url` =
  `/{locale}/checkout/cancelled`.
- `POST /api/paypal/capture` : identifie la commande soit par `orderId`, soit par
  le couple `orderNumber` + `paypalOrderId` (ce que PayPal renvoie dans l'URL) —
  les deux doivent correspondre à la ligne enregistrée. Si PayPal ne renvoie pas
  `COMPLETED` → 409 ; si le montant capturé ≠ total stocké → commande `failed` +
  `paypalStatus = AMOUNT_MISMATCH` et **aucune** livraison.
- `POST /api/paypal/webhook` : corps brut + en-têtes `PAYPAL-*` envoyés à
  `verify-webhook-signature` (401 sinon), uniquement `PAYMENT.CAPTURE.COMPLETED`,
  devise USD obligatoire, comparaison en centimes, `500` sur erreur inattendue
  pour que PayPal réessaie. Un événement rejoué ne renvoie pas d'erreur (200
  `handled: false`) et n'incrémente pas deux fois le compteur promo.
- `GET /api/orders/status` : aucune donnée client exposée, seulement `status`,
  total, `paidAt`, `webhookConfirmed`, `downloadsReady`.

### Interface

- `src/components/cart/cart-view.tsx` : quantités, suppression, vidage, code promo ;
  les totaux affichés proviennent de `/api/cart/price` (debounce 250 ms) et
  écrasent le sous-total local. État vide dédié.
- `src/app/[locale]/cart/page.tsx` : page `noindex`.
- `src/components/checkout/checkout-client.tsx` : email, conditions (avec liens
  vers CGV / remboursement / confidentialité), résumé, bouton PayPal. Vide le
  panier puis redirige vers `approvalUrl`. Erreur `promo_invalid` traduite.
- `src/components/checkout/checkout-success.tsx` : capture puis polling de
  `/api/orders/status` (12 × 2 s) pour attendre le webhook ; états
  `confirmed` / `pending` / `failed`, numéro de commande et total affichés.
- Pages `/checkout/success` et `/checkout/cancelled`, toutes en `noindex`.
- Clés `checkout.*` ajoutées dans les 3 locales via `scripts/patch-messages.mjs`
  (constante `CHECKOUT`), ainsi que `nav.newReleases` / `nav.bestsellers`.

### Pièges rencontrés

- **`Error: INSUFFICIENT_PATH`** au build : ce n'est pas un problème de `Link`,
  c'est `use-intl/format-message` qui refuse un message non-chaîne.
  `home.newReleases` et `home.bestsellers` sont des **objets** (copy des sections
  de la home), donc `tHome("newReleases")` échouait. Ajout de vraies clés
  `nav.newReleases` / `nav.bestsellers` dans les 3 locales.
- Les `Link` next-intl n'acceptent pas de chaîne avec `?` (`/books?sort=newest`
  levait une erreur) : forme `{ pathname: "/books", query: { sort: "newest" } }`
  partout (header, footer, home, fiche livre). `NavLink` a été élargi et les clés
  React passées de `key={link.href}` à `key={link.label}`.
- `import { Link } from "next/i18n/navigation"` → module introuvable ; il faut
  `@/i18n/navigation`.
- `sendOrderConfirmation` / `notifyNewOrder` attendent la forme `EmailOrder`
  complète : passer par `toEmailOrder(order, locale)`.
- Build vert : `npm.cmd run build` → 41 pages, 0 erreur TypeScript,
  0 `INSUFFICIENT_PATH`, 0 `MISSING_MESSAGE`.

### Reste à faire pour cette étape

- Renseigner `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV` et
  `PAYPAL_WEBHOOK_ID` (cf. `.env.example`), enregistrer le webhook
  `POST /api/paypal/webhook` sur l Events URL de l'application, puis tester un
  paiement sandbox de bout en bout.

---

## Étape 5 — Espace client, authentification et téléchargements sécurisés

**Statut : terminée (code prêt, à exécuter avec les clés Supabase).**

### Décisions structurantes

- **L'email de confirmation part uniquement du webhook.** L'email contient les
  liens de téléchargement : l'envoyer depuis `/api/paypal/capture` (qui peut
  s'exécuter avant le webhook) aurait envoyé des liens alors que
  `webhookConfirmedAt` est encore nul. La capture n'envoie donc plus rien.
- Nouvelle colonne `orders.emailed_at` : `markOrderEmailed()` fait un
  `UPDATE … WHERE emailed_at IS NULL` et renvoie `true` seulement s'il a
  écrit. Un événement PayPal rejoué ne peut pas réécrire au client.
- Nouvelle colonne `orders.locale` (`check (locale in ('en','fr','ar'))`) :
  une confirmation reçue uniquement par webhook retrouve la langue du client.
- **Invités** : lien HMAC-SHA256 par article,
  `/api/downloads/<orderItemId>?token=…`, signature
  `orderItemId.expiresAt.signature` en base64url, TTL 7 jours, comparée avec
  `timingSafeEqual`. Secret = `DOWNLOAD_LINK_SECRET`, sinon `CRON_SECRET`. Le
  jeton n'ouvre **que** les commandes `user_id IS NULL` : un client dont la
  commande a été remboursée ne peut pas réutiliser un lien resté dans un email.
- **Rattachement des commandes invité** : à la connexion/inscription,
  `claimGuestOrders(userId, email)` rattache les commandes payées dont
  `user_id IS NULL` et l'email correspond. La bibliothèque est donc complète dès
  la première visite.
- Aucune stratégie de RLS sur `orders` : toutes les lectures du compte passent
  par la couche Drizzle (`src/lib/account.ts`), enveloppée dans un `safe()` comme
  `src/lib/queries/catalog.ts`, pour que les pages restent rendues sans
  `DATABASE_URL`.

### Fichiers

- `src/lib/download-links.ts` : `createDownloadToken`, `verifyDownloadToken`,
  `guestDownloadUrl`, `GUEST_LINK_TTL_SECONDS`.
- `src/lib/account.ts` : `claimGuestOrders`, `getAccountProfile`,
  `getAccountOrders`, `getLibrary`, `getAccountStats`, `recordDownload`.
- `src/app/api/downloads/[orderItemId]/route.ts` : autorisation (session →
  `user_id`, ou invité dont l'email correspond, ou admin ; sinon jeton HMAC et
  commande non rattachée), écriture d'une ligne d'audit dans `downloads`, puis
  `NextResponse.redirect` vers une URL signée de 300 s. **Tous les échecs
  renvoient `notFound()`** pour ne rien laisser fuir de l'existence du fichier.
- `src/app/actions/auth.ts` : `signInAction`, `signUpAction`,
  `forgotPasswordAction`, `resetPasswordAction`, `signOutAction`. Codes d'erreur
  neutres (`invalidCredentials`, `emailTaken`, `weakPassword`, `generic`) que le
  client traduit via `auth.errors.*`. Email et mot de passe erronés rendent
  volontairement la **même** erreur. `safeNext()` bloque les URL absolues et
  `//evil.com`. Réinitialisation : `redirectTo: /api/auth/callback?next=…`.
- `src/app/actions/profile.ts` : `updateProfileAction` (Drizzle + miroir
  `supabase.auth.updateUser`).
- `src/app/api/auth/callback/route.ts` : échange PKCE. Placé sous `/api` **exprès**
  — le middleware next-intl ne réécrit pas ce chemin.
- `src/lib/schemas.ts` : `passwordSchema` (8–72, une lettre + un chiffre),
  `signInSchema`, `signUpSchema`, `forgotPasswordSchema`, `resetPasswordSchema`,
  `profileSchema`.
- `src/lib/format.ts` : `formatDate` / `formatDateTime` (`Intl.DateTimeFormat`) —
  module de dates unique, `src/lib/money.ts` n'en avait pas.
- `src/lib/env.ts` : `DOWNLOAD_LINK_SECRET` + `downloadLinkSecret()`.
- `src/lib/orders.ts` : `markOrderEmailed`, `toConfirmationEmail` (charge
  `books.pdfPath` pour savoir si un fichier existe, et n'attribue une URL
  qu'aux commandes invité), `locale` désormais persisté, compteur promo
  incrémenté seulement si `updated && webhookConfirmed && promoCode`.
- Pages : `/[locale]/auth/{page,sign-in,sign-up,forgot-password,reset-password}`
  et `/[locale]/account/{layout,page,orders,downloads,profile}`, plus
  `src/components/auth/{auth-shell,auth-message,sign-in-form,sign-up-form,
  forgot-password-form,reset-password-form}.tsx` et
  `src/components/account/{account-overview,library-grid,profile-form}.tsx`.
- `account.profile` a reçu `save` / `saved` dans les 3 locales.

### Pièges rencontrés

- `requireUser()` **lance** `UNAUTHENTICATED` : un `next build` qui pré-rendait
  `/[locale]/account/downloads` plantait le build. Corrigé par
  `export const dynamic = "force-dynamic"` dans `account/layout.tsx` (le
  segment layout s'applique à toute la branche).
- Next 16 type les props de layout via le global `LayoutProps<"/[locale]/account">`
  → `params: Promise<{ locale: string }>`. Annoter `params: Promise<{ locale:
  Locale }>` fait échouer `next build` alors que `tsc --noEmit` passe. Même
  correction sur `auth/layout.tsx`.
- `redirect()` importé dynamiquement (`const { redirect } = await
  import("next/navigation")`) ne **resserre pas** le type : TypeScript voit
  encore `user` comme nullable. Import statique obligatoire.
- `headers()` est asynchrone en Next 16 : `clientIp(new Request("http://localhost",
  { headers: headers() }))` ne typecheckait pas. `callerIp()` est devenu async.

### Correctifs apportés à l'étape 4

- `/api/checkout` **rejette** maintenant un code promo invalide
  (`promo_invalid` → 422). Avant, le code était enregistré sur la commande et le
  sous-total plein était débité.
- Le panier n'est plus vidé avant l'approbation PayPal : il l'est par
  `/checkout/success` une fois la capture réussie. Une annulation côté PayPal
  rend donc les articles au client au lieu de lui laisser un panier vide.
- Contrôle des montants **fail-closed** : capture et webhook traitent un montant
  absent ou illisible comme un mismatch (déjà `failed` + `AMOUNT_MISMATCH`)
  au lieu de valider le paiement.
- Lien `/auth/sign-up` du checkout : `href={`/${locale}/auth/sign-up`}` avec le
  `Link` sensible à la locale produisait `/en/en/auth/sign-up`.
- `checkout-success.tsx` : « Continue » en dur → `cart.continueShopping`.
- `sendOrderConfirmation` : CTA en `localeUrl(order.locale, "/account/downloads")`
  et lien de téléchargement par article.

### Reste à faire pour cette étape

- Exécuter `db/migrations/0000_init.sql` (il contient désormais `orders.locale`
  et `orders.emailed_at`), renseigner `DOWNLOAD_LINK_SECRET`, puis tester
  inscription → achat invité → téléchargement → téléchargement après
  connexion (le compte doit reprendre la commande).

---

## Étape 6 — Panneau d'administration

**Statut : terminée (code prêt, à exécuter avec les clés Supabase).**

### Lecture des données

- `src/lib/admin/queries.ts` (`import "server-only"`) : couche de lecture
  exclusively/admin, avec le même `safe()` que `src/lib/queries/catalog.ts`
  pour que le tableau de bord reste rendu même base injoignable.
  `getDashboardStats()` (CA payé, compteurs par statut, panier moyen),
  `getSalesSeries(30)` (buckets journaliers + trous comblés),
  `getTopBooks()`, `getRecentOrders()`, `getAdminBooks()` (+ slug de catégorie
  et nombre de commandes, pour interdire la suppression d'un livre vendu),
  `getBookIndex()`, `getAdminCategories()`, `getAdminOrders(status?)`,
  `getAdminOrderDetail()`, `getAdminPromos()`, `getAdminReviews(status?)`,
  `getSubscriberCount()`, `getUnreadContactCount()`, `getTotals()`.
- Aucune de ces pages n'utilise le client anon Supabase : `orders` n'a aucune
  policy RLS pour les utilisateurs, tout passe par Drizzle (service role).

### Écritures (Server Actions) — `src/app/actions/admin/`

| Fichier | Actions |
| --- | --- |
| `books.ts` | `createBookAction`, `updateBookAction`, `uploadBookCoverAction`, `uploadBookPdfAction`, `deleteBookAction`, `toggleBookActiveAction`, `moveBookCategoryAction` |
| `categories.ts` | `createCategoryAction`, `updateCategoryAction`, `deleteCategoryAction`, `reorderCategoriesAction` |
| `orders.ts` | `updateOrderStatusAction`, `updateOrderNoteAction`, `resendOrderEmailAction` |
| `promos.ts` | `createPromoAction`, `updatePromoAction`, `deletePromoAction`, `togglePromoActiveAction` |
| `reviews.ts` | `setReviewStatusAction`, `deleteReviewAction`, `moderateReviewsAction`, `recomputeBookRating` |
| `import.ts` | `importPdfsAction`, `publishBookAction`, `listImportDrafts` |

- Toutes les actions appellent `requireAdmin()` **avant** de toucher la base.
- `deleteBookAction` refuse (`delete_blocked`) dès qu'une ligne `order_items`
  existe : l'historique de commande doit rester lisible.
- Marquer une commande `paid` à la main renseigne aussi `paid_at`,
  `webhook_confirmed_at` et `paypal_status = 'MANUAL'` — sans cela, aucun
  téléchargement ne s'ouvrirait.
- `resendOrderEmailAction` remet `emailed_at` à `NULL` sur une commande
  confirmée : le prochain passage de la condition `emailed_at is null`
  autorise un nouvel envoi.
- `recomputeBookRating` recalcule `rating_avg` / `rating_count` sur les seuls
  avis approuvés, à chaque modération et à chaque suppression.

### Stockage — `src/lib/admin/storage.ts`

`uploadCover` (bucket `covers`, public, 5 Mo, types image raster + AVIF/WebP)
et `uploadPdf` (bucket `pdfs`, **privé**, 50 Mo, type forcé
`application/pdf`). `safeName()` normalise le nom (accents retirés, slug).
Le fichier précédent est supprimé après l'écriture du nouveau, jamais avant
(une écriture échouée ne doit pas laisser le livre sans PDF). Un PDF sans
l'extension attendue ou trop gros est rejeté **avant** tout appel réseau.

### Interface

- `admin/layout.tsx` : `force-dynamic`, redirection vers la connexion si
  aucune session, `notFound()` (et non 403) pour un non-admin — l'existence
  du panneau ne doit pas fuiter. Sept onglets + lien « voir la boutique ».
- `admin/page.tsx` : 6 cartes (CA, commandes, livres, clients, panier moyen,
  avis en attente), histogramme CSS sur 30 jours (`role="img"`, pas de
  librairie de graphiques dans le projet), top livres, dernières commandes.
- `admin/books` : tableau complet (couverture, catégorie, prix barré, ventes,
  badges publié/à la une/démo/PDF manquant), formulaire de création et
  d'édition (`book-form.tsx`), téléversements séparés (`book-uploads.tsx`),
  suppression protégée (`delete-book-button.tsx`).
- `admin/categories` : gestion en ligne des 3 langues, création, édition,
  réordonnancement, suppression (les livres survivent, `category_id` passe à
  `NULL`).
- `admin/orders` : filtres par statut dans l'URL (`?status=`), badge
  « webhook confirmé / en attente », détail avec identifiants PayPal et
  `order-status-form.tsx` (statut + note interne).
- `admin/promos` : code, type (pourcentage / montant fixe), valeur, minimum de
  panier, nombre d'utilisations, fenêtre de dates, activation.
- `admin/reviews` : file `pending` par défaut, puis `approved` / `rejected`.
- `admin/import` : glisser-déposer, analyse **dans le navigateur** (taille,
  nombre de pages lu dans les octets `/Type /Page`, titre proposé depuis le
  nom de fichier), édition des titres, puis envoi `multipart/form-data`.
  Chaque PDF devient un **brouillon inactif** (`isActive: false`, description
  `Draft imported …`) : un mauvais lot se dépublie, il ne se supprime pas.
  `publishBookAction` refuse tant que le prix est à 0 ou que la description
  est encore celle du brouillon.

### Pièges rencontrés

- `setRequestLocale` n'est **pas** exporté par `next-intl` mais par
  `next-intl/server`. Import erroné sur les 10 pages admin → erreur
  `TS2305`.
- Les types globaux `PageProps<"/…">` / `LayoutRoutes` sont générés dans
  `.next/types` par le build : ils ne connaissent pas une route tant que le
  build n'a pas tourné, donc `TS2344` sur les pages créées dans la même
  passe. Les pages du projet n'utilisent pas ces types : signature explicite
  `{ params: Promise<{ locale: Locale }> }` (+ `id` pour les segments
  dynamiques, `searchParams` pour les pages filtrées). Même remarque pour les
  layouts : `LayoutProps` est à conserver, mais il ne se vérifie qu'au build.
- `count()` de Drizzle ne compile pas dans un `Promise.all` avec `db.execute`
  (`PgSelectBuilder must have Symbol.iterator`) : remplacé par
  `sql<number>`count(*)::int``.
- `db.execute(...).rows` n'existe pas sur le `RowList` de Drizzle : remplacé
  par un `db.select({ id }).from(...).where(...).limit(1)` typé.
- Le `Switch` de Radix ne rend son `<input hidden>` que lorsqu'il est coché :
  la valeur doit être lue avec `formData.has("isActive")`, pas avec
  `formData.get("isActive")`.
- Aucun nouveau message n'était nécessaire pour la structure, sauf
  `admin.actions` (libellés génériques save / cancel / none / confirm),
  `admin.books.subtitleField` (le sous-titre du livre, `subtitle` étant déjà
  pris par le descriptif de page) et `admin.categories.empty`.

### Vérification

`npx.cmd tsc --noEmit` sans erreur, `npm.cmd run build` vert : 92 pages
statiques, 44 routes dont les 10 routes `/[locale]/admin/*`, toutes en rendu
dynamique.

### Reste à faire pour cette étape

- Exécuter la migration, se connecter en admin (un des emails de
  `ADMIN_EMAILS` devient admin au premier sign-in) puis charger les premiers
  PDF depuis `admin/import`. L'import manuel des fichiers de `D:\livrepdf`
  n'a pas été fait : il attend une validation explicite.

---

## Étape 7 — Données de démonstration, identité légale et guide de mise en ligne

**Statut : terminée.**

### Catalogue de démonstration

- `db/seed.sql` : 5 catégories (fiction, business, technology, personal growth,
  history) avec noms et descriptions en 3 langues, 12 livres fictifs et le code
  promo `WELCOME10` (10 %, minimum $10, 100 usages). Tout est en
  `on conflict (slug|code) do nothing` : le script peut être rejoué sans jamais
  écraser une fiche déjà éditée. Le dernier `select` renvoie le nombre de
  livres de démonstration insérés.
- Les livres de démo sont `is_demo = true`, actifs, **sans couverture ni PDF** :
  ils remplissent le catalogue, les filtres et les fiches sans permettre une
  vente. Trois titres sont en français et un en arabe pour vérifier la mise en
  page RTL.

### Un titre sans fichier ne peut pas être vendu

- `priceOrder()` (`src/lib/orders.ts`) lit désormais `books.pdfPath` et lève
  `OrderError("book_no_file")` quand le fichier manque. C'est la garantie qu'un
  brouillon d'import ou un livre en préparation ne peut pas être facturé :
  l'argent ne peut sortir que pour un fichier qui existe réellement.
- `/api/cart/price` renvoie le code d'erreur (409), `cart-view.tsx` l'affiche
  sous les totaux et **désactive le bouton de commande**
  (`pointer-events-none` + `aria-disabled` + `tabIndex={-1}`, et non un
  `disabled` sur un `<a>`, qui n'existe pas en HTML).
- `checkout-client.tsx` mappe `promo_invalid`, `book_no_file`,
  `book_unavailable`, `book_not_found` et `rate_limited` vers des libellés
  dédiés au lieu du message générique.
- 4 nouvelles clés `cart.*` : `unavailable`, `missingTitle`, `pricingFailed`,
  `tooManyAttempts` (en / fr / ar).

### Identité légale du vendeur

- `src/lib/seller.ts` : `sellerInfo()` lit `SELLER_NAME`, `SELLER_LEGAL_NAME`,
  `SELLER_KIND`, `SELLER_ADDRESS` (lignes séparées par `\n`), `SELLER_VAT`,
  `SELLER_REGISTRY`, `SELLER_COUNTRY` et `SELLER_GOVERNING_LAW`. **Tous
  optionnels** : un champ vide n'est simplement pas rendu, donc aucune adresse
  inventée ne peut se glisser dans les pages légales. `complete` vaut faux tant
  que l'adresse ou le droit applicable manquent — ce sont les deux premières
  questions d'un régulateur.
- Les trois pages `/legal/*` affichent désormais un bloc « Informations sur le
  vendeur » : nom commercial, raison sociale le cas échéant, siège,
  immatriculation, TVA, pays, droit applicable, puis l'adresse de contact.
  7 nouvelles clés `legal.seller.*` dans les 3 locales.
- `.env.example` : bloc `SELLER_*` ajouté, plus `DOWNLOAD_LINK_SECRET` qui
  manquait alors qu'il est déjà lu par `src/lib/env.ts`.

### Guide de mise en ligne

- `README.md` était encore celui de `create-next-app` : remplacé par un guide
  en 6 étapes (Supabase → Resend → PayPal → identité → déploiement → premier
  import), l'arborescence du projet, les commandes et un résumé du modèle de
  sécurité.
- Point qui compte : `PAYPAL_WEBHOOK_ID` ne peut pas être créé avant le
  déploiement, car le webhook a besoin d'une URL publique. Il est donc
  explicitement positionné à l'étape 5 du README, et non à l'étape 3.

### Vérification

`npx.cmd tsc --noEmit` sans erreur, `npm.cmd run build` vert : 92 pages
statiques, 44 routes.

### Reste à faire pour cette étape

- L'identité légale réelle (raison sociale, adresse, n° TVA, droit applicable,
  particulier ou société) reste inconnue : les variables `SELLER_*` sont
  prêtes à recevoir mais vides.
- Exécuter `0000_init.sql` puis `seed.sql` dans Supabase, renseigner
  `.env.local`, déployer, créer le webhook, puis importer les vrais PDF.

---

## Étape 8 — Dépôt Git, outillage de mise en ligne, déploiement

**Statut :** partially_done

### Objectif

Rendre le projet déployable sans intervention risquée : versionné proprement,
variables auditablement vérifiables, migration applicable en une commande, puis
push GitHub et déploiement Vercel.

### Outillage de mise en ligne

- `scripts/check-env.mjs` — audit des variables **sans jamais afficher une
  valeur** : il ne sort que des états (`missing`, `placeholder`, `ok`). C'est le
  seul script autorisé à diagnostiquer l'environnement sur une machine qui
  contient des clés réelles.
- `scripts/probe-db.mjs` — connexion Postgres en lecture seule. Il liste les
  tables présentes et indique si `0000_init.sql` doit être appliqué.
- `scripts/migrate.mjs` — applique `db/migrations/0000_init.sql` puis, avec
  `--seed`, `db/seed.sql`. **Dry run par défaut** : sans `--apply` il affiche le
  plan et sort avec le code 0 sans rien écrire. Une seule transaction pour tout
  le schéma : soit tout est créé, soit rien. Il refuse de tourner si la table
  `orders` existe déjà, pour ne jamais détruire un schéma existant.
- `package.json` : `typecheck`, `check` (typecheck + build), `env:check`,
  `db:probe`, `db:migrate`, `db:seed`, et `engines.node >= 20.9.0` — c'est la
  version qu'exige Next.js 16.
- `npm run check` devient la porte unique avant un push. `next build` reste
  volontairement hors de `check` : le voir passer vert à chaque push est plus
  utile qu'un garde qui se serait déclenché une fois sur dix.

### Vérification du build sans aucune variable

Point de sûreté vérifié : `.env.local` a été temporairement déplacé, puis
`npm run build` relance. Le build **passe quand même** — 92 pages, 44 routes. Le
catalogue se dégrade en « aucun livre » au lieu de faire planter le déploiement.
Conséquence utile : un build Vercel ne peut pas échouer pour cause de clé
manquante, et les erreurs visibles en production sont des problèmes de données,
pas des variables d'environnement.

### Dépôt Git

- `.gitignore` vérifié : `.env*` ignoré **sauf** `.env.example`, ainsi que
  `.next`, `.vercel`, `node_modules`, `*.tsbuildinfo`.
- `.gitattributes` ajouté : `* text=auto eol=lf`. Le projet est écrit sur
  Windows (CRLF) mais compilé sur Linux (Vercel), où un CRLF parasite peut casser
  un script shell ou un bloc SQL passé à `psql`.
- **Audit de fuite de secrets** avant le premier commit : les 16 valeurs de
  `.env.local` ont été comparées au contenu versionné. Résultat : **aucune fuite**,
  et surtout — **les 16 valeurs sont identiques à `.env.example`**. Autrement
  dit, `.env.local` n'a jamais été rempli : il n'y a aucun secret réel dans la
  machine ni dans le dépôt. Rien à révoquer.
- Un seul `git grep` par valeur, et seul le **nom** de la variable est signalé
  en cas de correspondance, jamais la valeur.
- Premier commit : `2a15a8e`, 206 fichiers.

### Reste à faire pour cette étape

- `NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL` (région à remplacer) et
  `ADMIN_EMAILS` sont encore sur leur valeur d'exemple dans `.env.local` :
  `npm run env:check` sort en 1 tant que ce n'est pas fait.
- `DOWNLOAD_LINK_SECRET` et les variables `SELLER_*` sont absentes. Sans la
  première, les liens invités retombent sur `CRON_SECRET`, ce qui fonctionne
  mais n'est pas l'intention.
- `gh` et `vercel` ne sont pas installés et aucun accès GitHub/Vercel n'est
  fourni : la création du dépôt et la mise en ligne doivent être faites à la
  main, ou après installation des CLI.
- 1 erreur ESLint résiduelle, dans `src/components/ui/carousel.tsx` : composant
  shadcn généré et jamais importé. Elle ne bloque ni le typecheck ni le build.
