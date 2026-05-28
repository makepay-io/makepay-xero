import { createHmac, randomBytes } from 'node:crypto';
import type { AppConfig, XeroInvoice, XeroTenant, XeroTokenSet } from './types.js';
import type { Repository } from './storage.js';

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

type ConnectionResponse = {
  tenantId: string;
  tenantName?: string;
  tenantType?: string;
  updatedDateUtc?: string;
};

function basicAuth(config: AppConfig): string {
  return Buffer.from(`${config.xeroClientId}:${config.xeroClientSecret}`).toString('base64');
}

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : ({} as T);
  if (!response.ok) {
    throw new Error(`Xero API ${response.status}: ${text || response.statusText}`);
  }
  return payload;
}

export function createOAuthState(config: AppConfig): string {
  const nonce = randomBytes(16).toString('hex');
  const signature = createHmac('sha256', config.oauthStateSecret).update(nonce).digest('hex');
  return `${nonce}.${signature}`;
}

export function verifyOAuthState(config: AppConfig, state: string): boolean {
  const [nonce, signature] = state.split('.');
  if (!nonce || !signature) {
    return false;
  }
  const expected = createHmac('sha256', config.oauthStateSecret).update(nonce).digest('hex');
  return expected === signature;
}

export function authorizationUrl(config: AppConfig, state: string): string {
  const url = new URL('https://login.xero.com/identity/connect/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.xeroClientId);
  url.searchParams.set('redirect_uri', `${config.publicAppUrl}/oauth/callback`);
  url.searchParams.set(
    'scope',
    [
      'offline_access',
      'accounting.transactions',
      'accounting.settings.read',
    ].join(' '),
  );
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCode(config: AppConfig, code: string): Promise<XeroTokenSet> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${config.publicAppUrl}/oauth/callback`,
  });
  const response = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basicAuth(config)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const token = await readResponse<TokenResponse>(response);
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    accessTokenExpiresAt: Date.now() + token.expires_in * 1000,
    connectedAt: new Date().toISOString(),
  };
}

export async function refreshTokenSet(
  config: AppConfig,
  repository: Repository,
  tokenSet: XeroTokenSet,
): Promise<XeroTokenSet> {
  if (tokenSet.accessTokenExpiresAt > Date.now() + 60_000) {
    return tokenSet;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokenSet.refreshToken,
  });
  const response = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basicAuth(config)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const token = await readResponse<TokenResponse>(response);
  const updated: XeroTokenSet = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    accessTokenExpiresAt: Date.now() + token.expires_in * 1000,
    connectedAt: tokenSet.connectedAt,
  };
  await repository.saveTokenSet(updated);
  return updated;
}

export async function listConnections(tokenSet: XeroTokenSet): Promise<XeroTenant[]> {
  const response = await fetch('https://api.xero.com/connections', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${tokenSet.accessToken}`,
    },
  });
  const connections = await readResponse<ConnectionResponse[]>(response);
  return connections.map((connection) => ({
    tenantId: connection.tenantId,
    tenantName: connection.tenantName,
    tenantType: connection.tenantType,
    updatedAt: connection.updatedDateUtc ?? new Date().toISOString(),
  }));
}

export async function getInvoice(
  tokenSet: XeroTokenSet,
  tenantId: string,
  invoiceId: string,
): Promise<XeroInvoice> {
  const response = await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${invoiceId}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${tokenSet.accessToken}`,
      'xero-tenant-id': tenantId,
    },
  });
  const payload = await readResponse<{ Invoices?: XeroInvoice[] }>(response);
  const invoice = payload.Invoices?.[0];
  if (!invoice) {
    throw new Error('Xero did not return the requested invoice.');
  }
  return invoice;
}

export async function createInvoicePayment(
  config: AppConfig,
  tokenSet: XeroTokenSet,
  tenantId: string,
  invoice: XeroInvoice,
  amount: number,
  paymentLinkUid: string,
): Promise<unknown> {
  const response = await fetch('https://api.xero.com/api.xro/2.0/Payments', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${tokenSet.accessToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': paymentLinkUid,
      'xero-tenant-id': tenantId,
    },
    body: JSON.stringify({
      Payments: [
        {
          Invoice: { InvoiceID: invoice.InvoiceID },
          Account: { Code: config.xeroPaymentAccountCode },
          Date: new Date().toISOString().slice(0, 10),
          Amount: amount,
          Reference: `MakePay ${paymentLinkUid}`,
        },
      ],
    }),
  });
  return await readResponse<unknown>(response);
}

export function verifyXeroWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  signingKey: string,
): boolean {
  if (!signature || !signingKey) {
    return false;
  }
  const expected = createHmac('sha256', signingKey).update(rawBody).digest('base64');
  return expected === signature;
}
