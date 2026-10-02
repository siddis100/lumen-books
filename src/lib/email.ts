import "server-only";
import { Resend } from "resend";
import { env, siteUrl } from "@/lib/env";
import { localeUrl } from "@/lib/seo";
import { formatPrice, CURRENCY } from "@/lib/money";
import type { Locale } from "@/i18n/routing";

/**
 * Transactional email through Resend (free tier: 100 emails/month).
 *
 * Every helper is best effort: a mail failure never breaks a purchase. Emails
 * are rendered with a small, dependency-free HTML template so there is no
 * client-side framework to keep in sync.
 */

let cachedClient: Resend | null = null;

function client(): Resend | null {
  const key = env().RESEND_API_KEY;
  if (!key) return null;
  cachedClient ??= new Resend(key);
  return cachedClient;
}

function fromAddress(): string {
  const from = env().EMAIL_FROM || "Lumen Books <onboarding@resend.dev>";
  return from;
}

/** Inline-styled wrapper: email clients ignore <style> blocks in most cases. */
function layout(options: { title: string; body: string; locale?: Locale; cta?: { label: string; url: string } }): string {
  const dir = options.locale === "ar" ? "rtl" : "ltr";
  return `<!doctype html>
<html lang="${options.locale ?? "en"}" dir="${dir}">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
  <body style="margin:0;padding:0;background:#f6f3ee;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#211f1c;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ee;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e9e2d6;overflow:hidden;">
          <tr><td style="padding:24px 28px;border-bottom:1px solid #efe9de;">
            <span style="font-size:18px;font-weight:700;letter-spacing:-0.01em;">Lumen <span style="color:#c2410c;">Books</span></span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${options.title}</h1>
            ${options.body}
            ${
              options.cta
                ? `<p style="margin:28px 0 0;"><a href="${options.cta.url}" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px;">${options.cta.label}</a></p>`
                : ""
            }
          </td></tr>
          <tr><td style="padding:18px 28px;background:#faf7f2;color:#6f6a63;font-size:12px;line-height:1.6;">
            Lumen Books · ${CURRENCY} prices · Instant download after payment.<br />
            This is an automated message. Your files stay available in your account.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function send(params: { to: string; subject: string; html: string }): Promise<boolean> {
  const resend = client();
  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[email] Resend not configured - skipped:", params.subject);
    }
    return false;
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      console.error("[email] send failed:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] send threw:", (error as Error).message);
    return false;
  }
}

const COPY = {
  en: {
    subject: `Your Lumen Books order ${"{order}"} is confirmed`,
    title: "Thank you for your order",
    intro: "Your payment has been received and confirmed by PayPal. Your eBooks are ready to download.",
    items: "Your eBooks",
    subtotal: "Subtotal",
    discount: "Discount",
    total: "Total paid",
    cta: "Download your books",
    downloadOne: "Download",
    fileSoon: "Your file is being prepared — you will be able to download it shortly.",
    footerNote: "If a link ever stops working, sign in to your account and download again at any time.",
  },
  fr: {
    subject: `Votre commande Lumen Books ${"{order}"} est confirmée`,
    title: "Merci pour votre commande",
    intro: "Votre paiement a été reçu et confirmé par PayPal. Vos eBooks sont prêts à être téléchargés.",
    items: "Vos eBooks",
    subtotal: "Sous-total",
    discount: "Remise",
    total: "Total payé",
    cta: "Télécharger vos livres",
    downloadOne: "Télécharger",
    fileSoon: "Votre fichier est en cours de préparation — vous pourrez le télécharger très bientôt.",
    footerNote: "Si un lien cesse de fonctionner, connectez-vous à votre compte pour télécharger à nouveau.",
  },
  ar: {
    subject: `تم تأكيد طلبك في Lumen Books ${"{order}"}`,
    title: "شكراً لطلبك",
    intro: "تم استلام دفعتك وتأكيدها عبر PayPal. كتبك الإلكترونية جاهزة للتحميل.",
    items: "كتبك الإلكترونية",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    total: "الإجمالي المدفوع",
    cta: "تحميل كتبك",
    downloadOne: "تحميل",
    fileSoon: "ملفك قيد التحضير — ستتمكن من تحميله بعد قليل.",
    footerNote: "إذا توقّف أحد الروابط عن العمل، سجّل الدخول إلى حسابك لتعيد التحميل في أي وقت.",
  },
} as const;

export type EmailOrderItem = {
  title: string;
  author: string;
  quantity: number;
  lineTotalCents: number;
  /** Signed, expiring link — guests only. Absent when the file is not ready. */
  downloadUrl?: string | null;
  /** False while the PDF is still being uploaded for that title. */
  hasFile?: boolean;
};
export type EmailOrder = {
  orderNumber: string;
  email: string;
  locale: Locale;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  items: EmailOrderItem[];
};

/** Sends the purchase confirmation with the download links. */
export async function sendOrderConfirmation(order: EmailOrder): Promise<boolean> {
  const copy = COPY[order.locale] ?? COPY.en;

  const downloadBlock = (url: string) =>
    `<p style="margin:6px 0 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;">${escapeHtml(copy.downloadOne)}</a></p>`;

  const rows = order.items
    .map((item) => {
      const download =
        item.downloadUrl && item.hasFile !== false
          ? downloadBlock(item.downloadUrl)
          : item.hasFile === false
            ? `<p style="margin:6px 0 0;color:#a8a29e;font-size:12px;">${escapeHtml(copy.fileSoon)}</p>`
            : "";
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0ebe2;font-size:14px;">
          <strong>${escapeHtml(item.title)}</strong><br />
          <span style="color:#6f6a63;font-size:12px;">${escapeHtml(item.author)}${item.quantity > 1 ? ` × ${item.quantity}` : ""}</span>
          ${download}
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #f0ebe2;font-size:14px;white-space:nowrap;vertical-align:top;">${escapeHtml(formatPrice(item.lineTotalCents))}</td>
      </tr>`;
    })
    .join("");

  const body = `
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;">${escapeHtml(copy.intro)}</p>
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#8a8177;">${copy.items}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:14px;">
      <tr><td style="padding:4px 0;color:#6f6a63;">${copy.subtotal}</td><td align="right" style="padding:4px 0;">${escapeHtml(formatPrice(order.subtotalCents))}</td></tr>
      ${order.discountCents > 0 ? `<tr><td style="padding:4px 0;color:#6f6a63;">${copy.discount}</td><td align="right" style="padding:4px 0;color:#15803d;">−${escapeHtml(formatPrice(order.discountCents))}</td></tr>` : ""}
      <tr><td style="padding:8px 0;font-weight:700;border-top:1px solid #efe9de;">${copy.total}</td><td align="right" style="padding:8px 0;font-weight:700;border-top:1px solid #efe9de;">${escapeHtml(formatPrice(order.totalCents))}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#6f6a63;">${escapeHtml(copy.footerNote)}</p>`;

  return send({
    to: order.email,
    subject: copy.subject.replace("{order}", order.orderNumber),
    html: layout({
      title: `${copy.title} · ${order.orderNumber}`,
      body,
      locale: order.locale,
      cta: { label: copy.cta, url: localeUrl(order.locale, "/account/downloads") },
    }),
  });
}

/** Welcome email after subscribing to the newsletter. */
export async function subscribeToNewsletter(email: string): Promise<boolean> {
  const site = siteUrl();
  return send({
    to: email,
    subject: "Welcome to Lumen Books",
    html: layout({
      title: "Welcome to Lumen Books",
      body: `<p style="margin:0;font-size:14px;line-height:1.7;">Thanks for subscribing. You will hear about new releases, curated collections and reading lists — no more than twice a month, and never resold.</p>`,
      cta: { label: "Browse the catalogue", url: `${site}/books` },
    }),
  });
}

/** New order notification for the store owner. */
export async function notifyNewOrder(order: EmailOrder): Promise<boolean> {
  const to = env().CONTACT_EMAIL;
  if (!to) return false;
  return send({
    to,
    subject: `New paid order ${order.orderNumber} (${formatPrice(order.totalCents)})`,
    html: layout({
      title: `New order ${order.orderNumber}`,
      body: `<p style="margin:0;font-size:14px;line-height:1.7;">${escapeHtml(order.email)} paid ${escapeHtml(formatPrice(order.totalCents))} for ${order.items.length} title(s).</p>`,
      cta: { label: "Open the admin", url: `${siteUrl()}/admin/orders` },
    }),
  });
}

/** Contact form confirmation sent to the sender. */
export async function sendContactAcknowledgement(email: string, subject: string): Promise<boolean> {
  return send({
    to: email,
    subject: `We received your message — ${subject}`,
    html: layout({
      title: "Message received",
      body: `<p style="margin:0;font-size:14px;line-height:1.7;">Thank you for contacting Lumen Books. We answer within two business days, in English.</p>`,
    }),
  });
}

/** Forwards a contact-form message to the store owner. */
export async function sendContactMessage(message: {
  name: string;
  email: string;
  orderNumber?: string | null;
  subject: string;
  body: string;
}): Promise<boolean> {
  const to = env().CONTACT_EMAIL;
  if (!to) return false;
  const rows = [
    `<p style="margin:0 0 8px;"><strong>Name:</strong> ${escapeHtml(message.name)}</p>`,
    `<p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(message.email)}</p>`,
    message.orderNumber
      ? `<p style="margin:0 0 8px;"><strong>Order:</strong> ${escapeHtml(message.orderNumber)}</p>`
      : "",
    `<p style="margin:16px 0 8px;"><strong>Message:</strong></p>`,
    `<p style="margin:0;font-size:14px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(message.body)}</p>`,
  ].join("");
  return send({
    to,
    subject: `[Contact] ${message.subject}`,
    html: layout({ title: message.subject, body: rows }),
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}