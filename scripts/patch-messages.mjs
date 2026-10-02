/**
 * Idempotent message patcher.
 *
 * Later features (catalogue, cart, checkout, account, admin) need keys that were
 * not part of the original 17-namespace draft. Rather than hand-editing three
 * large JSON files, this script merges the additions and keeps `en`, `fr` and
 * `ar` in sync.
 *
 * Run with: node scripts\patch-messages.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve("src/messages");

/**
 * mergeDeep(target, patch) — returns a new object, arrays are replaced.
 *
 * Refuses to overwrite an object with a scalar: a previous run of this script
 * replaced the whole `contact` namespace with a single string, which broke the
 * contact page in three locales.
 */
function mergeDeep(target, patch) {
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) return patch;
  const out = { ...(typeof target === "object" && target !== null ? target : {}) };
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key];
    if (current !== undefined && typeof current === "object" && typeof value === "string") {
      throw new Error(
        `Refusing to replace the object "${key}" with a string. Merge the scalar into a leaf key instead.`,
      );
    }
    out[key] =
      key in out && typeof out[key] === "object" && !Array.isArray(out[key])
        ? mergeDeep(out[key], value)
        : value;
  }
  return out;
}

const PATCHES = {
  en: {
    nav: { language: "Language" },
    metadata: { ogLocale: "en_US" },
    cookies: {
      title: "Your privacy, your choice",
      body: "We use strictly necessary cookies to run the shop (session, cart, security). With your permission we would also use privacy-friendly analytics. We never sell your data.",
      acceptAll: "Accept all",
      rejectAll: "Essential only",
      settings: "Manage choices",
      save: "Save my choice",
      essential: "Strictly necessary",
      essentialHint: "Required for sign-in, cart and downloads. Always active.",
      analytics: "Anonymous analytics",
      analyticsHint: "Helps us understand which pages are useful. No personal data, no advertising.",
    },
    book: {
      bestsellerBadge: "Bestseller",
      formatsShort: "EPUB + PDF",
      demoBadge: "Demo",
      by: "by",
      breadcrumb: "Breadcrumb",
    },
    home: { hero: { statsTitle: "Titles in the catalogue" } },
    catalog: {
      previousPage: "Previous",
      nextPage: "Next",
      page: "Page {page}",
      filtersTitle: "Filter the catalogue",
      searchHint: "Search by title, author or ISBN…",
    },
    contact: {
      metaTitle: "Contact",
      metaDescription: "Get in touch with the Lumen Books team. We answer every message within one business day.",
      title: "Contact us",
      lede: "Questions about an order, a title, or your invoice? Send us a message — a real person will reply within one business day.",
      form: {
        name: "Your name",
        email: "Email address",
        order: "Order number (optional)",
        subject: "Subject",
        message: "Message",
        submit: "Send message",
        sending: "Sending…",
        success: "Thank you — your message has been sent. We will reply shortly.",
        error: "We could not send your message. Please try again.",
      },
      channels: {
        title: "Other ways to reach us",
        email: "Email",
        responseTime: "Response time",
        responseTimeValue: "Within one business day",
        hours: "Support hours",
        hoursValue: "Monday to Friday, 09:00–17:00 UTC",
        languagesValue: "English, French, Arabic",
      },
    },
    cart: {
      viewCart: "View cart",
      quantity: "Quantity",
      decreaseQuantity: "Decrease quantity",
      increaseQuantity: "Increase quantity",
      itemsInCart: "{count, plural, one {# book} other {# books}} in cart",
    },
  },

  fr: {
    nav: { language: "Langue" },
    metadata: { ogLocale: "fr_FR" },
    cookies: {
      title: "Votre vie privée, votre choix",
      body: "Nous utilisons uniquement des cookies strictement nécessaires au fonctionnement de la boutique (session, panier, sécurité). Avec votre accord, nous pourrions ajouter une mesure d'audience anonyme. Nous ne vendons jamais vos données.",
      acceptAll: "Tout accepter",
      rejectAll: "Essentiels uniquement",
      settings: "Gérer mes choix",
      save: "Enregistrer mon choix",
      essential: "Strictement nécessaires",
      essentialHint: "Indispensables pour la connexion, le panier et les téléchargements. Toujours actifs.",
      analytics: "Analyse anonyme",
      analyticsHint: "Nous aide à comprendre quelles pages sont utiles. Aucune donnée personnelle, aucune publicité.",
    },
    book: {
      bestsellerBadge: "Meilleure vente",
      formatsShort: "EPUB + PDF",
      demoBadge: "Démo",
      by: "par",
      breadcrumb: "Fil d'Ariane",
    },
    home: { hero: { statsTitle: "Titres au catalogue" } },
    catalog: {
      previousPage: "Précédent",
      nextPage: "Suivant",
      page: "Page {page}",
      filtersTitle: "Filtrer le catalogue",
      searchHint: "Rechercher par titre, auteur ou ISBN…",
    },
    contact: {
      metaTitle: "Contact",
      metaDescription: "Contactez l'équipe Lumen Books. Nous répondons à chaque message sous un jour ouvré.",
      title: "Nous contacter",
      lede: "Une question sur une commande, un titre ou votre facture ? Envoyez-nous un message — une vraie personne vous répondra sous un jour ouvré.",
      form: {
        name: "Votre nom",
        email: "Adresse e-mail",
        order: "Numéro de commande (facultatif)",
        subject: "Objet",
        message: "Message",
        submit: "Envoyer le message",
        sending: "Envoi…",
        success: "Merci — votre message a bien été envoyé. Nous vous répondrons rapidement.",
        error: "Impossible d'envoyer votre message. Veuillez réessayer.",
      },
      channels: {
        title: "Autres façons de nous joindre",
        email: "E-mail",
        responseTime: "Délai de réponse",
        responseTimeValue: "Sous un jour ouvré",
        hours: "Horaires d'assistance",
        hoursValue: "Du lundi au vendredi, 09h00–17h00 UTC",
        languagesValue: "Français, anglais, arabe",
      },
    },
    cart: {
      viewCart: "Voir le panier",
      quantity: "Quantité",
      decreaseQuantity: "Diminuer la quantité",
      increaseQuantity: "Augmenter la quantité",
      itemsInCart: "{count, plural, one {# livre} other {# livres}} dans le panier",
    },
  },

  ar: {
    nav: { language: "اللغة" },
    metadata: { ogLocale: "ar_AR" },
    cookies: {
      title: "خصوصيتك، خيارك",
      body: "نستخدم ملفات تعريف الارتباط الضرورية فقط لتشغيل المتجر (الجلسة، السلة، الأمان). وبإذنك يمكننا إضافة تحليلات مجهولة الهوية. لا نبيع بياناتك أبداً.",
      acceptAll: "قبول الكل",
      rejectAll: "الضرورية فقط",
      settings: "إدارة خياراتي",
      save: "حفظ اختياراتي",
      essential: "ضرورية فقط",
      essentialHint: "لازمة لتسجيل الدخول والسلة والتحميل. مفعّلة دائماً.",
      analytics: "تحليلات مجهولة",
      analyticsHint: "تساعدنا على معرفة الصفحات المفيدة. بدون بيانات شخصية وبدون إعلانات.",
    },
    book: {
      bestsellerBadge: "الأكثر مبيعاً",
      formatsShort: "EPUB + PDF",
      demoBadge: "تجريبي",
      by: "بقلم",
      breadcrumb: "مسار التنقل",
    },
    home: { hero: { statsTitle: "العناوين في الكتالوج" } },
    catalog: {
      previousPage: "السابق",
      nextPage: "التالي",
      page: "صفحة {page}",
      filtersTitle: "تصفية الكتالوج",
      searchHint: "ابحث بالعنوان أو المؤلف أو ISBN…",
    },
    contact: {
      metaTitle: "اتصل بنا",
      metaDescription: "تواصل مع فريق Lumen Books. نردّ على كل رسالة خلال يوم عمل واحد.",
      title: "اتصل بنا",
      lede: "لديك سؤال عن طلب أو عنوان أو فاتورة؟ أرسل لنا رسالة — سيرد عليك شخص حقيقي خلال يوم عمل واحد.",
      form: {
        name: "اسمك",
        email: "البريد الإلكتروني",
        order: "رقم الطلب (اختياري)",
        subject: "الموضوع",
        message: "الرسالة",
        submit: "إرسال الرسالة",
        sending: "جارٍ الإرسال…",
        success: "شكراً — تم إرسال رسالتك وسنردّ عليك قريباً.",
        error: "تعذّر إرسال رسالتك. يرجى المحاولة مرة أخرى.",
      },
      channels: {
        title: "طرق تواصل أخرى",
        email: "البريد الإلكتروني",
        responseTime: "زمن الرد",
        responseTimeValue: "خلال يوم عمل واحد",
        hours: "ساعات الدعم",
        hoursValue: "من الاثنين إلى الجمعة، 09:00–17:00 UTC",
        languagesValue: "العربية، الإنجليزية، الفرنسية",
      },
    },
    cart: {
      viewCart: "عرض السلة",
      quantity: "الكمية",
      decreaseQuantity: "إنقاص الكمية",
      increaseQuantity: "زيادة الكمية",
      itemsInCart: "{count, plural, one {كتاب واحد} two {كتابان} few {# كتب} many {# كتاباً} other {# كتاب}} في السلة",
    },
  },
};

/**
 * Legal documents. Kept in the message files so the whole site stays
 * translatable, and written as `{title, body}` sections rendered by
 * `src/app/[locale]/legal/[doc]/page.tsx`.
 *
 * NOTE: the seller identity (legal entity name, registered address, tax number,
 * governing law) must be completed before the shop goes live — see LOG.md.
 */
const LEGAL = {
  en: {
    contact: "Any question about this document: {email}",
    terms: {
      intro: "These terms govern the purchase of digital books from Lumen Books. By checking out you accept them.",
      sections: [
        {
          title: "1. Who we are",
          body: "Lumen Books (\"the seller\", \"we\") is an independent digital bookshop. We sell downloadable books directly, without any physical shipping. You can reach us at any time through the contact form or by email.",
        },
        {
          title: "2. What you are buying",
          body: "Each product page lists the exact formats included (EPUB and/or PDF) and the file size. You receive a personal, non-exclusive, non-transferable licence to read the work on your own devices. You may not resell, share, redistribute or publicly post the files, and you may not use them to train machine-learning models.",
        },
        {
          title: "3. Prices and currency",
          body: "All prices are in US dollars (USD) and may change without notice. Where applicable, taxes or duties are calculated and collected according to the rules that apply to your country at checkout. A price error that is obviously incorrect does not bind us; we will contact you and offer the correct price before capturing the payment.",
        },
        {
          title: "4. Payment",
          body: "Payment is handled entirely by PayPal. We never receive or store your card number. An order is only considered paid once PayPal has confirmed the transaction to us; your download links unlock at that exact moment, never before.",
        },
        {
          title: "5. Delivery",
          body: "Delivery is digital and immediate: as soon as the payment is confirmed, the files appear under My account → Downloads (or in the download email). Download links are short-lived signed links; the account, not the link, is what gives you permanent access. We may refuse or reverse a delivery in the rare case of suspected fraud or chargeback abuse.",
        },
        {
          title: "6. Accounts",
          body: "An account is optional to buy but recommended to keep your purchases. You are responsible for the confidentiality of your credentials and for everything done through your account. You may request the deletion of your account at any time; order records required by accounting law are kept without your personal identifiers where possible.",
        },
        {
          title: "7. Reviews",
          body: "You may submit a rating and a review for a book you bought. Reviews are moderated before publication: we remove spam, abuse and anything unrelated. We never edit the substance of a review to change its meaning.",
        },
        {
          title: "8. Intellectual property",
          body: "The titles sold here remain the property of their authors and publishers. Lumen Books holds the distribution rights for the catalogue and owns the storefront, the cover artwork it produced and the editorial descriptions.",
        },
        {
          title: "9. Availability and liability",
          body: "The shop and the download service are provided on an \"as is\" and \"as available\" basis. We work hard to keep them running but cannot guarantee uninterrupted availability. Our liability is limited to the price you paid for the affected order, except where consumer law gives you more protection.",
        },
        {
          title: "10. Refunds",
          body: "Because these are digital files, refunds follow a dedicated policy: see the Refund Policy page. Mandatory consumer rights remain unaffected.",
        },
        {
          title: "11. Governing law",
          body: "These terms are governed by the laws applicable to the seller's registered place of business, without excluding the mandatory consumer protections of your country of residence. Where two rules conflict, the one that gives you more protection applies.",
        },
        {
          title: "12. Changes to these terms",
          body: "We may update this document as the shop evolves. The version published on the day of your purchase is the version that applies to that order.",
        },
      ],
    },
    privacy: {
      intro: "This policy explains what personal data Lumen Books collects, why, and what you can do about it.",
      sections: [
        {
          title: "1. Who is responsible",
          body: "Lumen Books is the data controller for the data collected through this shop. Questions about this policy go to the email address shown on the contact page.",
        },
        {
          title: "2. What we collect",
          body: "Account data: your email address and, if you set one, your display name. Order data: order number, email, the titles you bought, the amount, and the PayPal transaction identifier. Technical data: your IP address for rate limiting and fraud prevention, and strictly necessary cookies such as session, cart, language, theme and cookie consent. Newsletter: your email address and your consent date, if you subscribe.",
        },
        {
          title: "3. What we never collect",
          body: "We never see or store your card or bank details — payments happen on PayPal's servers. We do not build advertising profiles and we do not sell data to anyone.",
        },
        {
          title: "4. Why we use it",
          body: "To perform the contract: deliver the files, provide the account and the downloads. For our legitimate interests: keeping the shop secure, preventing fraud and abuse, and understanding which pages are useful in aggregate. With your consent: the newsletter and optional anonymous analytics. You can withdraw consent at any time.",
        },
        {
          title: "5. Who we share it with",
          body: "Supabase (database, authentication and file storage), PayPal (payment processing), Resend (transactional email) and Vercel (hosting). Each of them processes data only to provide its service to us. No other recipient, and no sale.",
        },
        {
          title: "6. How long we keep it",
          body: "Order and accounting records are kept for the period required by tax and accounting law. Newsletter subscriptions are kept until you unsubscribe. Rate-limiting counters are kept for a few hours. Account data is kept until you request deletion.",
        },
        {
          title: "7. Your rights",
          body: "You can ask for access to your data, correct it, delete it, export it, object to certain uses, or withdraw a consent. Contact us and we will answer within thirty days. You also have the right to complain to your local data-protection authority.",
        },
        {
          title: "8. Cookies",
          body: "Strictly necessary cookies (session, cart, security, language, theme, cookie consent) are always active because the shop cannot work without them. Optional anonymous analytics cookies are only set if you accept them in the cookie banner, and the banner lets you change that choice at any time from the footer link.",
        },
        {
          title: "9. Security",
          body: "The database is protected by row-level security, book files live in a private storage bucket and are served through short-lived signed links, and every sensitive endpoint is rate limited. No system is perfect, but we never treat your data casually.",
        },
        {
          title: "10. Children",
          body: "The shop is not directed at children under sixteen, and we do not knowingly collect data from them. If you believe a child has given us data, contact us and we will delete it.",
        },
        {
          title: "11. International transfers",
          body: "Our providers process data in countries other than your own, including the United States. Where required, transfers rely on standard contractual clauses and equivalent safeguards.",
        },
        {
          title: "12. Changes",
          body: "When this policy changes, the new version is published on this page. Material changes affecting existing customers are announced by email.",
        },
      ],
    },
    refund: {
      intro: "These books are digital files that cannot be returned. That is why refunds here are rare, fast and reserved for real problems.",
      sections: [
        {
          title: "1. Principle",
          body: "Once a digital file has been downloaded, it cannot be returned or resold, so change-of-mind refunds are not possible. Refunds and replacements are issued when something is genuinely wrong with your order.",
        },
        {
          title: "2. When you are refunded",
          body: "The file is corrupt or cannot be opened. The download is missing or fails repeatedly. The title you received is not the title you ordered. You were charged twice for the same order. A promo code or pricing error was applied to your order in our favour.",
        },
        {
          title: "3. What we do first",
          body: "In every case we start by fixing the order: we re-upload the file or send you the correct title. If that is not possible within a reasonable delay, you get a full refund. You do not have to argue for it twice.",
        },
        {
          title: "4. How to ask",
          body: "Write to us from the email address used for the purchase, with your order number and one or two sentences describing the problem. We answer within two business days.",
        },
        {
          title: "5. How you are refunded",
          body: "Refunds are sent through PayPal to the original payment method and usually appear on your statement within three to ten business days, depending on your bank. We never refund to a different account, and we never ask for card details.",
        },
        {
          title: "6. What is not refundable",
          body: "Change of mind after downloading. A device or reader that is not supported, when the formats are listed clearly before purchase. Titles bought at a promotional price you knowingly accepted. Orders placed through resellers we do not control.",
        },
        {
          title: "7. Chargebacks",
          body: "Please contact us before opening a dispute with PayPal: most chargebacks are faster and simpler to solve directly. Unjustified chargebacks may lead to a restriction of the account.",
        },
        {
          title: "8. Partial refunds",
          body: "When an order contains several titles and only one of them is defective, we first replace that title. If replacement is impossible, we refund the proportional share of the order.",
        },
        {
          title: "9. Your statutory rights",
          body: "Nothing in this policy limits the mandatory consumer rights of your country, including the right to a remedy where a digital product is not as described.",
        },
      ],
    },
  },

  fr: {
    contact: "Toute question sur ce document : {email}",
    terms: {
      intro: "Ces conditions régissent l'achat de livres numériques auprès de Lumen Books. En validant votre commande, vous les acceptez.",
      sections: [
        {
          title: "1. Qui sommes-nous",
          body: "Lumen Books (« le vendeur », « nous ») est une librairie numérique indépendante. Nous vendons des livres téléchargeables en direct, sans aucune expédition physique. Vous pouvez nous joindre à tout moment via le formulaire de contact ou par e-mail.",
        },
        {
          title: "2. Ce que vous achetez",
          body: "Chaque fiche produit indique précisément les formats inclus (EPUB et/ou PDF) et la taille du fichier. Vous recevez une licence personnelle, non exclusive et non cessible de lire l'œuvre sur vos propres appareils. Vous ne pouvez ni revendre, ni partager, ni redistribuer, ni publier les fichiers, ni les utiliser pour entraîner des modèles d'apprentissage automatique.",
        },
        {
          title: "3. Prix et devise",
          body: "Tous les prix sont en dollars américains (USD) et peuvent être modifiés sans préavis. Lorsque cela s'applique, les taxes ou droits sont calculés et perçus selon les règles de votre pays au moment du paiement. Un prix manifestement erroné ne nous engage pas : nous vous contactons et proposons le prix correct avant tout encaissement.",
        },
        {
          title: "4. Paiement",
          body: "Le paiement est entièrement traité par PayPal. Nous ne recevons ni ne conservons votre numéro de carte. Une commande n'est considérée comme payée que lorsque PayPal nous a confirmé la transaction : vos liens de téléchargement s'ouvrent à cet instant précis, jamais avant.",
        },
        {
          title: "5. Livraison",
          body: "La livraison est numérique et immédiate : dès la confirmation du paiement, les fichiers apparaissent sous Mon compte → Téléchargements (ou dans l'e-mail de téléchargement). Les liens sont des liens signés de courte durée ; c'est le compte, et non le lien, qui vous donne un accès permanent. Nous pouvons refuser ou annuler une livraison en cas de suspicion de fraude ou d'abus de rétrofacturation.",
        },
        {
          title: "6. Comptes",
          body: "Un compte est facultatif pour acheter mais recommandé pour conserver vos achats. Vous êtes responsable de la confidentialité de vos identifiants et de tout ce qui est fait via votre compte. Vous pouvez demander la suppression de votre compte à tout moment ; les commandes que la loi comptable nous impose de conserver sont conservées sans identifiants personnels lorsque c'est possible.",
        },
        {
          title: "7. Avis",
          body: "Vous pouvez déposer une note et un avis sur un livre acheté. Les avis sont modérés avant publication : nous supprimons le spam, les abus et tout ce qui est hors sujet. Nous ne modifions jamais le fond d'un avis au point d'en changer le sens.",
        },
        {
          title: "8. Propriété intellectuelle",
          body: "Les titres vendus demeurent la propriété de leurs auteurs et éditeurs. Lumen Books détient les droits de diffusion du catalogue et possède la boutique, les couvertures qu'elle a produites et les descriptions éditoriales.",
        },
        {
          title: "9. Disponibilité et responsabilité",
          body: "La boutique et le service de téléchargement sont fournis « tels quels » et « selon disponibilité ». Nous veillons à leur disponibilité mais ne pouvons garantir une interruption nulle. Notre responsabilité est limitée au prix payé pour la commande concernée, sauf si le droit de la consommation vous accorde davantage.",
        },
        {
          title: "10. Remboursements",
          body: "Ces fichiers étant numériques, les remboursements suivent une politique dédiée : voir la page Politique de remboursement. Vos droits légaux de consommation restent inchangés.",
        },
        {
          title: "11. Droit applicable",
          body: "Ces conditions sont régies par le droit applicable au siège du vendeur, sans exclure les protections impératives du consommateur dans votre pays de résidence. En cas de conflit, la règle la plus protectrice pour vous s'applique.",
        },
        {
          title: "12. Modification des conditions",
          body: "Nous pouvons mettre à jour ce document selon l'évolution de la boutique. C'est la version publiée le jour de votre achat qui s'applique à cette commande.",
        },
      ],
    },
    privacy: {
      intro: "Cette politique explique quelles données personnelles Lumen Books collecte, pourquoi, et ce que vous pouvez en faire.",
      sections: [
        {
          title: "1. Responsable",
          body: "Lumen Books est responsable du traitement des données collectées sur cette boutique. Toute question se pose à l'adresse e-mail indiquée sur la page contact.",
        },
        {
          title: "2. Données collectées",
          body: "Données de compte : votre e-mail et, si vous le définissez, votre nom affiché. Données de commande : numéro de commande, e-mail, titres achetés, montant et identifiant de transaction PayPal. Données techniques : votre adresse IP pour la limitation de débit et la prévention de la fraude, et les cookies strictement nécessaires (session, panier, langue, thème, consentement). Newsletter : votre e-mail et la date de votre consentement.",
        },
        {
          title: "3. Données jamais collectées",
          body: "Nous ne voyons ni ne conservons vos données bancaires : le paiement se fait sur les serveurs de PayPal. Nous ne créons pas de profils publicitaires et ne vendons aucune donnée.",
        },
        {
          title: "4. Finalités",
          body: "Exécuter le contrat : livrer les fichiers, fournir le compte et les téléchargements. Nos intérêts légitimes : sécuriser la boutique, prévenir la fraude et les abus, et comprendre quelles pages sont utiles de manière agrégée. Avec votre consentement : la newsletter et la mesure d'audience anonyme facultative. Vous pouvez retirer votre consentement à tout moment.",
        },
        {
          title: "5. Destinataires",
          body: "Supabase (base de données, authentification et stockage), PayPal (paiement), Resend (e-mails transactionnels) et Vercel (hébergement). Chacun traite les données uniquement pour fournir son service. Aucun autre destinataire, aucune vente.",
        },
        {
          title: "6. Durées de conservation",
          body: "Les pièces comptables sont conservées pendant la durée imposée par la loi fiscale et comptable. L'abonnement à la newsletter est conservé jusqu'à votre désinscription. Les compteurs de limitation sont conservés quelques heures. Les données de compte jusqu'à votre demande de suppression.",
        },
        {
          title: "7. Vos droits",
          body: "Vous pouvez demander l'accès, la rectification, la suppression, la portabilité de vos données, vous opposer à certains usages ou retirer un consentement. Écrivez-nous : nous répondons sous trente jours. Vous pouvez aussi saisir l'autorité de protection des données de votre pays.",
        },
        {
          title: "8. Cookies",
          body: "Les cookies strictement nécessaires (session, panier, sécurité, langue, thème, consentement) sont toujours actifs car la boutique ne fonctionne pas sans eux. Les cookies de mesure anonyme facultatifs ne sont déposés que si vous les acceptez dans le bandeau, que vous pouvez modifier à tout moment via le lien du pied de page.",
        },
        {
          title: "9. Sécurité",
          body: "La base est protégée par sécurité au niveau des lignes, les fichiers vivent dans un bucket privé servis par des liens signés à durée limitée, et chaque endpoint sensible est limité. Aucun système n'est infaillible, mais vos données ne sont jamais traitées à la légère.",
        },
        {
          title: "10. Enfants",
          body: "La boutique ne s'adresse pas aux enfants de moins de seize ans et nous ne collectons pas sciemment leurs données. Si vous pensez qu'un enfant nous a transmis des données, contactez-nous : nous les supprimons.",
        },
        {
          title: "11. Transferts internationaux",
          body: "Nos prestataires traitent des données dans des pays autres que le vôtre, notamment aux États-Unis. Lorsque c'est nécessaire, les transferts reposent sur des clauses contractuelles types et des garanties équivalentes.",
        },
        {
          title: "12. Modifications",
          body: "Toute modification est publiée sur cette page. Les changements importants concernant les clients existants sont annoncés par e-mail.",
        },
      ],
    },
    refund: {
      intro: "Ces livres sont des fichiers numériques qui ne peuvent pas être retournés. C'est pourquoi les remboursements sont rares, rapides et réservés aux vrais problèmes.",
      sections: [
        {
          title: "1. Principe",
          body: "Une fois un fichier numérique téléchargé, il ne peut être ni retourné ni revendu : le remboursement pour simple changement d'avis est donc impossible. Remboursements et remplacements interviennent lorsqu'un problème réel affecte votre commande.",
        },
        {
          title: "2. Cas de remboursement",
          body: "Le fichier est corrompu ou impossible à ouvrir. Le téléchargement est manquant ou échoue à répétition. Le titre reçu n'est pas celui commandé. Vous avez été débité deux fois pour la même commande. Un code promo ou une erreur de prix a été appliqué dans notre sens.",
        },
        {
          title: "3. Notre première action",
          body: "Dans tous les cas, nous commençons par corriger la commande : nous ré-uplaodons le fichier ou envoyons le bon titre. Si c'est impossible dans un délai raisonnable, vous obtenez un remboursement intégral. Inutile d'en discuter deux fois.",
        },
        {
          title: "4. Comment demander",
          body: "Écrivez-nous depuis l'adresse e-mail utilisée pour l'achat, avec votre numéro de commande et une ou deux phrases décrivant le problème. Nous répondons sous deux jours ouvrés.",
        },
        {
          title: "5. Modalités de remboursement",
          body: "Le remboursement passe par PayPal vers le moyen de paiement d'origine et apparaît généralement sur votre relevé sous trois à dix jours ouvrés, selon votre banque. Nous ne remboursons jamais vers un autre compte et ne demandons jamais de données de carte.",
        },
        {
          title: "6. Non remboursable",
          body: "Le changement d'avis après téléchargement. Un appareil ou une liseuse non compatible, lorsque les formats sont indiqués clairement avant l'achat. Les titres achetés à un prix promotionnel que vous avez accepté. Les commandes passées chez des revendeurs que nous ne contrôlons pas.",
        },
        {
          title: "7. rétrofacturations",
          body: "Contactez-nous avant d'ouvrir un litige PayPal : la plupart se règlent plus vite et plus simplement en direct. Une rétrofacturation injustifiée peut entraîner une restriction du compte.",
        },
        {
          title: "8. Remboursement partiel",
          body: "Si une commande contient plusieurs titres et qu'un seul est défectueux, nous remplaçons d'abord ce titre. Si le remplacement est impossible, nous remboursons la part proportionnelle de la commande.",
        },
        {
          title: "9. Vos droits légaux",
          body: "Rien dans cette politique ne limite les droits impératifs du consommateur de votre pays, y compris le droit à réparation lorsqu'un produit numérique n'est pas conforme à sa description.",
        },
      ],
    },
  },

  ar: {
    contact: "أي سؤال حول هذه الوثيقة: {email}",
    terms: {
      intro: "تحكم هذه الشروط شراء الكتب الرقمية من Lumen Books. بإتمامك للطلب فإنك تقبل هذه الشروط.",
      sections: [
        {
          title: "١. من نحن",
          body: "Lumen Books («البائع» أو «نحن») مكتبة رقمية مستقلة. نبيع كتباً قابلة للتنزيل مباشرةً دون أي شحن مادي. يمكنك التواصل معنا في أي وقت عبر نموذج الاتصال أو البريد الإلكتروني.",
        },
        {
          title: "٢. ما الذي تشتريه",
          body: "تذكر صفحة كل كتاب الصيغ المتاحة بدقة (EPUB و/أو PDF) وحجم الملف. تحصل على ترخيص شخصي وغير حصري وغير قابل للتنازل لقراءة العمل على أجهزتك. لا يجوز إعادة البيع أو المشاركة أو إعادة التوزيع أو النشر العام للملفات، ولا استخدامها لتدريب نماذج التعلم الآلي.",
        },
        {
          title: "٣. الأسعار والعملة",
          body: "جميع الأسعار بالدولار الأمريكي (USD) وقد تتغير دون إشعار. حيثما ينطبق، تُحسب الضرائب أو الرسوم وفق قواعد بلدك عند الدفع. خطأ سعري واضح لا يُلزمنا: نتواصل معك ونعرض السعر الصحيح قبل أي تحصيل.",
        },
        {
          title: "٤. الدفع",
          body: "يتم الدفع بالكامل عبر PayPal. لا نتلقى رقم بطاقتك ولا نحتفظ به. لا تُعتبر الطلبات مدفوعة إلا بعد تأكيد PayPal للمعاملة لنا، وعندها فقط تُفتح روابط التنزيل، ولا قبل ذلك أبداً.",
        },
        {
          title: "٥. التسليم",
          body: "التسليم رقمي وفوري: بمجرد تأكيد الدفع تظهر الملفات في «حسابي ← التنزيلات» (أو في رسالة التنزيل). الروابط روابط موقّعة قصيرة الصلاحية؛ الحساب لا الرابط هو ما يمنحك وصولاً دائماً. يجوز لنا رفض التسليم أو التراجع عنه في حالة الاشتباه بالاحتيال أو إساءة استخدام الدفعات العكسية.",
        },
        {
          title: "٦. الحسابات",
          body: "الحساب اختياري للشراء لكن مُستحسن للاحتفاظ بمشترياتك. أنت مسؤول عن سرية بيانات دخولك وعن كل ما يتم عبر حسابك. يمكنك طلب حذف حسابك في أي وقت، وتُحفظ سجلات الطلبات التي تفرضها المحاسبة دون معرّفات شخصية متى أمكن.",
        },
        {
          title: "٧. التقييمات",
          body: "يمكنك تقديم تقييم ومراجعة لكتاب اشتريته. تُراجَع التقييمات قبل النشر: نحذف الرسائل المزعجة والإساءة وما لا علاقة له بالكتاب، ولا نغيّر جوهر التقييم حتى يتغير معناه.",
        },
        {
          title: "٨. الملكية الفكرية",
          body: "تبقى العناوين المبيعة ملكاً لمؤلفيها وناشريها. تمتلك Lumen Books حقوق التوزيع للكتالوج، إضافة إلى المتجر وأغلفة الصور التي أنتجتها والأوصاف التحريرية.",
        },
        {
          title: "٩. التوافر والمسؤولية",
          body: "يُقدَّم المتجر وخدمة التنزيل «كما هي» و«حسب التوفر». نعمل على استمرارتهما لكن لا نضمن انقطاعاً معدوماً. تقتصر مسؤوليتنا على السعر المدفوع للطلب المعني، إلا إذا منحتك قوانين المستهلك حماية أكبر.",
        },
        {
          title: "١٠. الاسترداد",
          body: "لأن هذه ملفات رقمية، تتبع الاستردادات سياسة مخصصة: راجع صفحة سياسة الاسترداد. حقوق المستهلك القانونية تبقى سارية.",
        },
        {
          title: "١١. القانون الحاكم",
          body: "تخضع هذه الشروط للقوانين المنطبقة على المقر المسجل للبائع، دون استبعاد حماية المستهلك الآمرة في بلد إقامتك. وعند التعارض يسري ما يحميك أكثر.",
        },
        {
          title: "١٢. تعديل الشروط",
          body: "قد نحدّث هذه الوثيقة مع تطور المتجر. النسخة المنشورة يوم الشراء هي التي تسري على ذلك الطلب.",
        },
      ],
    },
    privacy: {
      intro: "توضح هذه السياسة البيانات الشخصية التي يجمعها Lumen Books ولماذا، وما حقك في ذلك.",
      sections: [
        {
          title: "١. الجهة المسؤولة",
          body: "Lumen Books هي المتحكم في البيانات التي تُجمع عبر المتجر. تُرسل جميع الأسئلة إلى عنوان البريد الإلكتروني الظاهر في صفحة الاتصال.",
        },
        {
          title: "٢. البيانات التي نجمعها",
          body: "بيانات الحساب: بريدك الإلكتروني واسمك الظاهر إن اخترته. بيانات الطلب: رقم الطلب، البريد، العناوين المشتراة، المبلغ، ومعرّف معاملة PayPal. البيانات التقنية: عنوان IP لتحديد المعدل ومنع الاحتيال، وملفات تعريف الارتباط الضرورية (الجلسة، السلة، اللغة، المظهر، الموافقة). النشرة البريدية: بريدك وتاريخ موافقتك.",
        },
        {
          title: "٣. ما لا نجمعه",
          body: "لا نرى بياناتك المصرفية ولا نخزّنها — الدفع يتم على خوادم PayPal. لا نبني ملفات إعلانية ولا نبيع أي بيانات.",
        },
        {
          title: "٤. لماذا نستخدمها",
          body: "لتنفيذ العقد: تسليم الملفات، وتوفير الحساب والتنزيلات. لمصالحنا المشروعة: تأمين المتجر، ومنع الاحتيال وإساءة الاستخدام، وفهم الصفحات المفيدة بشكل مجمّع. بموافقتك: النشرة البريدية والتحليلات المجهولة الاختيارية. يمكنك سحب موافقتك في أي وقت.",
        },
        {
          title: "٥. من يشاركه",
          body: "Supabase (قاعدة البيانات والمصادقة والتخزين)، وPayPal (الدفع)، وResend (البريد الإلكتروني)، وVercel (الاستضافة). يعالج كل منها البيانات لتقديم خدمته لنا فقط، ولا يوجد أي مستلم آخر ولا بيع.",
        },
        {
          title: "٦. مدة الاحتفاظ",
          body: "تُحفظ السجلات المحاسبية للمدة التي تفرضها الضرائب وقوانين المحاسبة. تبقى الاشتراكات في النشرة حتى تلغي اشتراكك. تبقى عدادات تحديد المعدد لساعات. تبقى بيانات الحساب حتى تطلب حذفها.",
        },
        {
          title: "٧. حقوقك",
          body: "يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها أو تصديرها أو الاعتراض على بعض الاستخدامات أو سحب الموافقة. راسلنا ونردّ خلال ثلاثين يوماً. ولك الحق في تقديم شكوى لدى جهة حماية البيانات في بلدك.",
        },
        {
          title: "٨. ملفات تعريف الارتباط",
          body: "الملفات الضرورية (الجلسة، السلة، الأمان، اللغة، المظهر، الموافقة على الكوكيز) نشطة دائماً لأن المتجر لا يعمل بدونها. أما التحليلات المجهولة الاختيارية فلا تُضبط إلا بقبولك لها في الشريط، ويمكنك تغيير اختيارك في أي وقت من رابط التذييل.",
        },
        {
          title: "٩. الأمان",
          body: "قاعدة البيانات محمية بأمان على مستوى الصفوف، وملفات الكتب في حاوية خاصة تُقدَّم عبر روابط موقّعة قصيرة الصلاحية، وكل نقطة حساسة محدودة المعدل. لا يوجد نظام محصّن تماماً، لكننا لا نتعامل مع بياناتك باستخفاف.",
        },
        {
          title: "١٠. الأطفال",
          body: "المتجر غير موجّه للأطفال دون سن ше عشرة، ولا نجمع بياناتهم عن علم. إذا اعتقدت أن طفلاً زوّدنا ببياناته فتواصل معنا وسنحذفها.",
        },
        {
          title: "١١. النقل الدولي",
          body: "يعالج مزوّدونا البيانات في دول أخرى غير دولتك، منها الولايات المتحدة. وعند الضرورة تستند النقلات إلى البنود التعاقدية النموذجية والضمانات المكافئة.",
        },
        {
          title: "١٢. التعديلات",
          body: "تُنشر أي تعديلات على هذه الصفحة، وتُعلَن التغييرات الجوهرية للعملاء الحاليين بالبريد الإلكتروني.",
        },
      ],
    },
    refund: {
      intro: "هذه الكتب ملفات رقمية لا يمكن إرجاعها، ولذلك تكون الاستردادات نادرة وسريعة ومخصّصة للمشاكل الحقيقية.",
      sections: [
        {
          title: "١. المبدأ",
          body: "بعد تنزيل الملف الرقمي لا يمكن إرجاعه ولا إعادة بيعه، لذلك لا يُقبل الاسترداد لمجرد تغيّر الرأي. الاسترداد والاستبدال يحدثان عند وجود مشكلة حقيقية في طلبك.",
        },
        {
          title: "٢. الحالات التي يُسترد فيها المبلغ",
          body: "الملف تالف أو لا يمكن فتحه. رابط التنزيل مفقود أو يفشل بشكل متكرر. العنوان الذي وصلك ليس العنوان الذي طلبته. تم خصم المبلغ مرتين للطلب نفسه. طُبِّق رمز خصم أو خطأ سعري لصالحنا.",
        },
        {
          title: "٣. ما نفعله أولاً",
          body: "في كل الحالات نبدأ بتصحيح الطلب: نعيد رفع الملف أو نرسل العنوان الصحيح. وإذا تعذّر ذلك خلال مدة معقولة فتحصل على استرداد كامل، دون حاجة للجدال مرتين.",
        },
        {
          title: "٤. كيفية الطلب",
          body: "اكتب إلينا من البريد المستخدم في الشراء مع رقم الطلب ووصف المشكلة في جملة أو جملتين. نردّ خلال يومَي عمل.",
        },
        {
          title: "٥. طريقة الاسترداد",
          body: "يتم الاسترداد عبر PayPal إلى وسيلة الدفع الأصلية، ويظهر عادةً في كشفك خلال ثلاثة إلى عشرة أيام عمل حسب بنكك. لا نسترد أبداً إلى حساب آخر ولا نطلب بيانات بطاقة.",
        },
        {
          title: "٦. غير قابل للاسترداد",
          body: "تغيّر الرأي بعد التنزيل. جهاز أو قارئ غير مدعوم، عندما تكون الصيغ موضّحة قبل الشراء. عناوين شُريت بسعر ترويجي قبلته عن علم. الطلبات الموضوعة لدى موزعين لا نتحكم فيهم.",
        },
        {
          title: "٧. الدفعات العكسية",
          body: "راسلنا قبل فتح نزاع مع PayPal: معظمها يُحلّ أسرع وأسهل مباشرةً. أما الدفعات العكسية غير المبرّرة فقد تؤدي إلى تقييد الحساب.",
        },
        {
          title: "٨. استرداد جزئي",
          body: "إذا اشتمل الطلب على عدة عناوين وكان أحدها معطوباً، نستبدله أولاً. وإذا استحال الاستبدال نعيد المبلغ بالنسبة المتناسبة.",
        },
        {
          title: "٩. حقوقك القانونية",
          body: "لا يحدّ هذا البيان من حقوق المستهلك الإلزامية في بلدك، بما في ذلك حق التعويض حين لا يطابق المنتج الرقمي وصفه.",
        },
      ],
    },
  },
};

/**
 * Checkout form copy, added when the PayPal pipeline (cart → checkout →
 * capture → webhook) was implemented. `fr` and `ar` are hand-written, not
 * machine translations.
 */
const CHECKOUT = {
  en: {
    checkout: {
      email: "Email address",
      emailHint: "Your receipt and download links are sent to this address.",
      emailInvalid: "Please enter a valid email address.",
      termsAccept: "I accept the Terms of Sale and the Refund Policy.",
      termsRequired: "Please accept the terms to continue.",
      paypalUnavailable: "Payments are not available yet. Please try again shortly.",
      downloadReady: "Your files are ready",
      downloadPendingHint: "Download links unlock as soon as PayPal confirms the payment.",
      securityNote: "You will be taken to PayPal to approve the payment, then returned here.",
      lineItem: "Line item",
      unitPrice: "Unit price",
      quantityLabel: "Qty",
      lineTotal: "Total",
      applyPromo: "Promo code",
      invalidEmailHint: "Use the same address you signed up with, so your library stays in one place.",
    },
  },
  fr: {
    checkout: {
      email: "Adresse e-mail",
      emailHint: "Votre reçu et vos liens de téléchargement sont envoyés à cette adresse.",
      emailInvalid: "Veuillez saisir une adresse e-mail valide.",
      termsAccept: "J'accepte les Conditions de vente et la Politique de remboursement.",
      termsRequired: "Veuillez accepter les conditions pour continuer.",
      paypalUnavailable: "Le paiement n'est pas encore disponible. Réessayez dans un instant.",
      downloadReady: "Vos fichiers sont prêts",
      downloadPendingHint: "Les liens de téléchargement se débloquent dès que PayPal confirme le paiement.",
      securityNote: "Vous serez redirigé vers PayPal pour approuver le paiement, puis ramené ici.",
      lineItem: "Article",
      unitPrice: "Prix unitaire",
      quantityLabel: "Qté",
      lineTotal: "Total",
      applyPromo: "Code promo",
      invalidEmailHint: "Utilisez l'adresse avec laquelle vous vous êtes inscrit, pour garder votre bibliothèque au même endroit.",
    },
  },
  ar: {
    checkout: {
      email: "البريد الإلكتروني",
      emailHint: "يُرسل الإيصال وروابط التنزيل إلى هذا العنوان.",
      emailInvalid: "يرجى إدخال بريد إلكتروني صحيح.",
      termsAccept: "أوافق على شروط البيع وسياسة الاسترداد.",
      termsRequired: "يرجى الموافقة على الشروط للمتابعة.",
      paypalUnavailable: "الدفع غير متاح حالياً. يرجى المحاولة بعد قليل.",
      downloadReady: "ملفاتك جاهزة",
      downloadPendingHint: "تُفتح روابط التنزيل فور تأكيد PayPal للدفع.",
      securityNote: "سيتم تحويلك إلى PayPal للموافقة على الدفع ثم إعادتك إلى هنا.",
      lineItem: "العنصر",
      unitPrice: "سعر الوحدة",
      quantityLabel: "الكمية",
      lineTotal: "الإجمالي",
      applyPromo: "رمز الخصم",
      invalidEmailHint: "استخدم نفس العنوان الذي سجّلت به، حتى تبقى مكتبتك في مكان واحد.",
    },
  },
};

const NAV_LINKS = {
  en: { newReleases: "New releases", bestsellers: "Best-sellers" },
  fr: { newReleases: "Nouveautés", bestsellers: "Meilleures ventes" },
  ar: { newReleases: "أحدث الإصدارات", bestsellers: "الأكثر مبيعاً" },
};

for (const [locale, patch] of Object.entries(PATCHES)) {
  const legal = LEGAL[locale];
  if (!legal) throw new Error(`Missing legal content for ${locale}`);
  const checkout = CHECKOUT[locale];
  if (!checkout) throw new Error(`Missing checkout copy for ${locale}`);
  const nav = NAV_LINKS[locale];
  if (!nav) throw new Error(`Missing nav labels for ${locale}`);
  const file = resolve(dir, `${locale}.json`);
  const current = JSON.parse(readFileSync(file, "utf8"));
  // Earlier runs of this script (before the `legal` wrapper was introduced)
  // wrote these documents at the root; drop the leftovers.
  for (const stray of ["terms", "privacy", "refund"]) delete current[stray];
  // `home.newReleases` / `home.bestsellers` are objects (homepage section copy),
  // so the header cannot reuse them as link labels: it needs its own strings.
  const next = mergeDeep(mergeDeep(mergeDeep(current, patch), { legal }), { nav, ...checkout });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`patched ${locale}.json`);
}