import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  authorizationUrl,
  createOAuthState,
  verifyOAuthState,
  verifyXeroWebhookSignature,
} from '../src/xero.js';
import type { AppConfig } from '../src/types.js';

const config: AppConfig = {
  port: 3000,
  publicAppUrl: 'https://app.example.com',
  xeroClientId: 'client_id',
  xeroClientSecret: 'client_secret',
  oauthStateSecret: 'state_secret',
  xeroPaymentAccountCode: '970',
  xeroWebhookSigningKey: 'webhook_signing_key',
  makePayBaseUrl: 'https://makepay.example.com',
  makePayKeyId: 'key_id',
  makePayKeySecret: 'key_secret',
  makePayWebhookSecret: 'webhook_secret',
  adminToken: 'test_admin_token_123',
};

describe('Xero OAuth helpers', () => {
  it('creates and verifies signed OAuth state values', () => {
    const state = createOAuthState(config);
    expect(verifyOAuthState(config, state)).toBe(true);
    expect(verifyOAuthState(config, `${state}x`)).toBe(false);
  });

  it('builds the Xero authorization URL', () => {
    const url = new URL(authorizationUrl(config, 'state'));
    expect(url.hostname).toBe('login.xero.com');
    expect(url.searchParams.get('scope')).toContain('accounting.transactions');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/oauth/callback');
  });

  it('verifies Xero webhook signatures', () => {
    const rawBody = Buffer.from(JSON.stringify({ events: [] }));
    const signature = createHmac('sha256', config.xeroWebhookSigningKey)
      .update(rawBody)
      .digest('base64');
    expect(verifyXeroWebhookSignature(rawBody, signature, config.xeroWebhookSigningKey)).toBe(true);
    expect(verifyXeroWebhookSignature(rawBody, `${signature}x`, config.xeroWebhookSigningKey)).toBe(false);
  });
});
