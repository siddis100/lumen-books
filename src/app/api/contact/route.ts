import { NextResponse, type NextRequest } from "next/server";
import { contactSchema } from "@/lib/schemas";
import { rateLimit, clientIp, jsonError } from "@/lib/rate-limit";
import { sendContactMessage, sendContactAcknowledgement } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Contact form endpoint. Validated with Zod, rate limited per IP, forwarded to
 * the store owner through Resend and acknowledged to the sender.
 *
 * No database write on purpose: the conversation lives in email, which keeps
 * the message readable and avoids storing personal data we do not need.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = await rateLimit("contact", ip, 5, 3600);
  if (!limited.ok) return jsonError("rate_limited", 429, { retryAfter: limited.retryAfter });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsed = contactSchema.safeParse(json);
  if (!parsed.success) return jsonError("invalid_payload", 422);

  const { name, email, orderNumber, subject, body } = parsed.data;

  const delivered = await sendContactMessage({ name, email, orderNumber, subject, body }).catch(() => false);
  if (!delivered) return jsonError("contact_unavailable", 503);

  await sendContactAcknowledgement(email, subject).catch(() => false);

  return NextResponse.json({ ok: true }, { status: 201 });
}