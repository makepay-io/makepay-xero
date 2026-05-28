export type AppConfig = {
  port: number;
  publicAppUrl: string;
  xeroClientId: string;
  xeroClientSecret: string;
  oauthStateSecret: string;
  xeroPaymentAccountCode: string;
  xeroWebhookSigningKey: string;
  makePayBaseUrl: string;
  makePayKeyId: string;
  makePayKeySecret: string;
  makePayWebhookSecret: string;
  adminToken: string;
};

export type XeroTokenSet = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  connectedAt: string;
};

export type XeroTenant = {
  tenantId: string;
  tenantName?: string;
  tenantType?: string;
  updatedAt: string;
};

export type XeroInvoice = {
  InvoiceID: string;
  InvoiceNumber?: string;
  Reference?: string;
  AmountDue?: number;
  Total?: number;
  CurrencyCode?: string;
  Contact?: {
    ContactID?: string;
    Name?: string;
    EmailAddress?: string;
  };
};

export type PaymentMapping = {
  tenantId: string;
  invoiceId: string;
  paymentLinkUid: string;
  paymentUrl?: string;
  amount: number;
  status: 'created' | 'paid';
  createdAt: string;
  paidAt?: string;
};

export type MakePayWebhookEvent = {
  type?: string;
  event?: { type?: string };
  session?: { status?: string };
  paymentLink?: { uid?: string; id?: string; status?: string };
  data?: Record<string, unknown>;
};
