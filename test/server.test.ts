import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/server.js';
import { MemoryRepository } from '../src/storage.js';
import type { AppConfig, XeroTokenSet } from '../src/types.js';

const config: AppConfig = {
  port: 3000,
  publicAppUrl: 'https://app.example.com',
  xeroClientId: 'xero_client',
  xeroClientSecret: 'xero_secret',
  oauthStateSecret: 'state_secret',
  xeroPaymentAccountCode: '970',
  xeroWebhookSigningKey: 'xero_webhook_secret',
  makePayBaseUrl: 'https://makepay.example.com',
  makePayKeyId: 'mk_test',
  makePayKeySecret: 'mksec_test',
  makePayWebhookSecret: 'webhook_secret',
  adminToken: 'test_admin_token_123',
};

const tokenSet: XeroTokenSet = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  accessTokenExpiresAt: Date.now() + 3_600_000,
  connectedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makePaySignature(rawBody: string): string {
  const timestamp = '1779997509';
  const digest = createHmac('sha256', config.makePayWebhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Xero connector', () => {
  it('creates a MakePay link for a Xero invoice and reconciles paid webhooks', async () => {
    const repository = new MemoryRepository();
    await repository.saveTokenSet(tokenSet);
    await repository.saveTenant({ tenantId: 'tenant_123', tenantName: 'Demo Org', updatedAt: new Date().toISOString() });

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.endsWith('/Invoices/inv_42') && init?.method === 'GET') {
        return jsonResponse({
          Invoices: [
            {
              InvoiceID: 'inv_42',
              InvoiceNumber: 'INV-42',
              AmountDue: 129.99,
              CurrencyCode: 'USD',
              Contact: { Name: 'Example Buyer', EmailAddress: 'buyer@example.com' },
            },
          ],
        });
      }
      if (requestUrl.endsWith('/api/partner/v1/makepay/payment-links')) {
        return jsonResponse({
          paymentLink: {
            uid: 'pay_42',
            publicUrl: 'https://makepay.io/payment/pay_42',
          },
        });
      }
      if (requestUrl.endsWith('/Payments') && init?.method === 'POST') {
        return jsonResponse({ Payments: [{ PaymentID: 'pmt_900' }] });
      }
      return jsonResponse({ message: 'not found' }, 404);
    });

    vi.stubGlobal('fetch', fetchMock);

    const app = createApp(config, repository);

    await request(app)
      .post('/admin/invoices/tenant_123/inv_42/payment-link')
      .set('authorization', `Bearer ${config.adminToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.paymentLinkUid).toBe('pay_42');
      });

    const rawBody = JSON.stringify({
      type: 'makepay.payment.status_changed',
      session: { status: 'paid' },
      paymentLink: { uid: 'pay_42' },
    });

    await request(app)
      .post('/webhooks/makepay')
      .set('content-type', 'application/json')
      .set('x-makepay-signature', makePaySignature(rawBody))
      .send(rawBody)
      .expect(200)
      .expect((response) => {
        expect(response.body.reconciled).toBe(true);
      });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.xero.com/api.xro/2.0/Payments',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
