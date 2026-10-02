import "server-only";

import { env } from "@/lib/env";
import { centsToPayPalAmount, paypalAmountToCents, CURRENCY } from "@/lib/money";

/**
 * Thin, typed wrapper around the PayPal REST API (Orders v2).
 *
 * The shop uses PayPal and nothing else: no direct card processing, no other
 * processor, and every amount is expressed in USD cents.
 */

export type PayPalEnvironment = "sandbox" | "live";

export function paypalEnvironment(): PayPalEnvironment {
  return env().PAYPAL_ENV;
}

function apiBase(mode: PayPalEnvironment): string {
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

/* ------------------------------------------------------------------ *
 * Access token
 * ------------------------------------------------------------------ */

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const mode = paypalEnvironment();
  const now = Date.now();

  // Refresh a minute early to avoid races with concurrent requests.
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.value;

  const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = env();
  const basic = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");

  const response = await fetch(`${apiBase(mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PayPal authentication failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return cachedToken.value;
}

async function paypalFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const mode = paypalEnvironment();
  const token = await getAccessToken();

  const response = await fetch(`${apiBase(mode)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PayPal ${init.method ?? "GET"} ${path} failed (${response.status}): ${body.slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

/* ------------------------------------------------------------------ *
 * Orders v2
 * ------------------------------------------------------------------ */

export type PayPalOrderLineItem = {
  name: string;
  /** Digital goods have no shipping. */
  unit_amount: { currency_code: string; value: string };
  quantity: string;
  category?: string;
};

export type PayPalOrderResponse = {
  id: string;
  status: string;
  links?: { href: string; rel: string; method?: string }[];
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    amount: { currency_code: string; value: string };
    payments?: {
      captures?: {
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
        final_capture?: boolean;
      }[];
    };
  }[];
};

export type CreateOrderInput = {
  /** Internal order id stored as `custom_id` for webhook reconciliation. */
  orderId: string;
  /** Human-readable reference shown on the PayPal approval screen. */
  orderNumber: string;
  items: { name: string; unitPriceCents: number; quantity: number }[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  /** USD cents refunded to the customer, if any. */
  refundCents?: number;
  returnUrl: string;
  cancelUrl: string;
  /** Prefilled PayPal email for signed-in customers. */
  customerEmail?: string;
  /** Store locale, mapped to a tag PayPal actually accepts. */
  locale?: string;
};

/**
 * PayPal validates `experience_context.locale` against a fixed list of BCP-47
 * tags and rejects the whole order otherwise. Arabic is not in that list, so an
 * `ar` shopper falls back to English rather than breaking the checkout. Keep
 * this an allowlist: an unmapped tag costs an order, not a warning.
 */
function paypalLocale(locale: string | undefined): string {
  return locale?.slice(0, 2).toLowerCase() === "fr" ? "fr-FR" : "en-US";
}

/**
 * Creates a PayPal order.
 *
 * No `payer` object is sent, which keeps the order in guest checkout: the buyer
 * is not forced to sign in to PayPal and can settle with a card instead of a
 * PayPal balance. That is what makes the checkout reachable from countries
 * where PayPal accounts cannot send payments.
 *
 * `payment_source.paypal.experience_context` is the current shape; the older
 * `application_context` is deprecated.
 */
export async function createPayPalOrder(input: CreateOrderInput): Promise<PayPalOrderResponse> {
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: input.orderId,
        custom_id: input.orderId,
        invoice_id: input.orderNumber,
        description: `Lumen Books — ${input.orderNumber}`,
        soft_descriptor: "LUMEN BOOKS",
        amount: {
          currency_code: CURRENCY,
          value: centsToPayPalAmount(input.totalCents),
          breakdown: {
            item_total: { currency_code: CURRENCY, value: centsToPayPalAmount(input.subtotalCents) },
            shipping: { currency_code: CURRENCY, value: centsToPayPalAmount(0) },
            ...(input.discountCents > 0
              ? { discount: { currency_code: CURRENCY, value: centsToPayPalAmount(input.discountCents) } }
              : {}),
            ...(input.refundCents
              ? { refund: { currency_code: CURRENCY, value: centsToPayPalAmount(input.refundCents) } }
              : {}),
          },
        },
        items: input.items.map((item) => ({
          name: item.name.slice(0, 127),
          unit_amount: {
            currency_code: CURRENCY,
            value: centsToPayPalAmount(item.unitPriceCents),
          },
          quantity: String(item.quantity),
          category: "DIGITAL_GOODS",
        })),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Lumen Books",
          locale: paypalLocale(input.locale),
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
          ...(input.customerEmail
            ? { shipping_address: { email_address: input.customerEmail } }
            : {}),
        },
      },
    },
  };

  return paypalFetch<PayPalOrderResponse>("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Captures an approved order.
 *
 * `Prefer: return=representation` makes PayPal return the full order so the
 * server can verify the captured amount before unlocking downloads.
 */
export async function capturePayPalOrder(
  orderId: string,
): Promise<PayPalOrderResponse & { _links?: { href: string; rel: string }[] }> {
  return paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: "{}",
  });
}

export async function getPayPalOrder(orderId: string): Promise<PayPalOrderResponse> {
  return paypalFetch<PayPalOrderResponse>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

export async function refundPayPalCapture(
  captureId: string,
  amountCents: number,
  note = "Refund issued by Lumen Books",
): Promise<void> {
  await paypalFetch(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    method: "POST",
    body: JSON.stringify({
      amount: { currency_code: CURRENCY, value: centsToPayPalAmount(amountCents) },
      note_to_payer: note,
    }),
  });
}

/* ------------------------------------------------------------------ *
 * Webhook signature verification
 * ------------------------------------------------------------------ */

export type VerifyWebhookResult = {
  verification_status: "SUCCESS" | "FAILURE";
  webhook_id?: string;
  webhook_event?: {
    id: string;
    event_type: string;
    resource: Record<string, unknown>;
  };
};

/**
 * Verifies a webhook call using PayPal's `verify-webhook-signature` endpoint.
 *
 * This is done with the *raw* request body plus the `PAYPAL-*` headers, exactly
 * as PayPal documents it. Verification failures are fatal.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  headers: Headers,
): Promise<VerifyWebhookResult> {
  const { PAYPAL_WEBHOOK_ID } = env();
  if (!PAYPAL_WEBHOOK_ID) {
    throw new Error("PAYPAL_WEBHOOK_ID is not configured — cannot verify webhook signatures.");
  }

  const required = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ] as const;

  for (const name of required) {
    if (!headers.get(name)) {
      throw new Error(`Missing PayPal signature header: ${name}`);
    }
  }

  return paypalFetch<VerifyWebhookResult>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(rawBody) as Record<string, unknown>,
    }),
  });
}

/* ------------------------------------------------------------------ *
 * Amount helpers
 * ------------------------------------------------------------------ */

/** Total captured in USD cents, or `null` when the capture is absent. */
export function capturedAmountCents(order: PayPalOrderResponse): number | null {
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) return null;
  return paypalAmountToCents(capture.amount.value);
}

export function capturedId(order: PayPalOrderResponse): string | null {
  return order.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;
}

/** True only when PayPal reports the capture as final and completed. */
export function isCaptureComplete(order: PayPalOrderResponse): boolean {
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  return capture?.status === "COMPLETED";
}