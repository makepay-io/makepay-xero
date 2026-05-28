import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AppConfig, MakePayWebhookEvent, XeroInvoice } from './types.js';

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : ({} as T);
  if (!response.ok) {
    throw new Error(`MakePay API ${response.status}: ${text || response.statusText}`);
  }
  return payload;
}

export async function createPaymentLinkForInvoice(
  config: AppConfig,
  tenantId: string,
  invoice: XeroInvoice,
): Promise<{ uid: string; paymentUrl?: string; amount: number }> {
  const amount = Number(invoice.AmountDue ?? invoice.Total ?? 0);
  const response = await fetch(`${config.makePayBaseUrl}/api/partner/v1/makepay/payment-links`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-MakeCrypto-Key-Id': config.makePayKeyId,
      'X-MakeCrypto-Key-Secret': config.makePayKeySecret,
    },
    body: JSON.stringify({
      status: 'active',
      sendPaymentRequestEmail: true,
      payload: {
        title: `Xero invoice ${invoice.InvoiceNumber ?? invoice.InvoiceID}`,
        description: `Payment for Xero invoice ${invoice.InvoiceNumber ?? invoice.InvoiceID}`,
        amount: String(amount),
        currency: invoice.CurrencyCode,
        orderId: invoice.InvoiceID,
        merchantOrderId: `${tenantId}:${invoice.InvoiceID}`,
        customerEmail: invoice.Contact?.EmailAddress,
        metadata: {
          platform: 'xero',
          tenantId,
          invoiceId: invoice.InvoiceID,
        },
      },
    }),
  });
  const payload = await readResponse<{
    paymentLink?: { uid?: string; id?: string; publicUrl?: string; checkoutUrl?: string };
    uid?: string;
    id?: string;
    publicUrl?: string;
    checkoutUrl?: string;
  }>(response);
  const link = payload.paymentLink ?? payload;
  const uid = link.uid ?? link.id;
  if (!uid) {
    throw new Error('MakePay did not return a payment link UID.');
  }
  return { uid, paymentUrl: link.publicUrl ?? link.checkoutUrl, amount };
}

export function verifyMakePaySignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) {
    return false;
  }
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, value] = part.trim().split('=');
      return [key, value];
    }),
  );
  if (!parts.t || !parts.v1) {
    return false;
  }
  const expected = createHmac('sha256', secret)
    .update(`${parts.t}.${rawBody.toString('utf8')}`)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(parts.v1, 'hex');
  return (
    expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export function extractPaymentLinkUid(event: MakePayWebhookEvent): string | undefined {
  const data = event.data ?? {};
  const candidate =
    event.paymentLink?.uid ??
    event.paymentLink?.id ??
    data.paymentLinkUid ??
    data.payment_link_uid ??
    data.uid;
  return typeof candidate === 'string' ? candidate : undefined;
}

export function isPaidMakePayEvent(event: MakePayWebhookEvent): boolean {
  const values = [
    event.type,
    event.event?.type,
    event.session?.status,
    event.paymentLink?.status,
  ].filter(Boolean);
  return values.some((value) => {
    const normalized = String(value).toLowerCase();
    return normalized === 'paid' || normalized.includes('payment.paid');
  });
}
