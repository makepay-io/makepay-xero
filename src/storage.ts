import type { PaymentMapping, XeroTenant, XeroTokenSet } from './types.js';

export interface Repository {
  saveTokenSet(tokenSet: XeroTokenSet): Promise<void>;
  getTokenSet(): Promise<XeroTokenSet | undefined>;
  saveTenant(tenant: XeroTenant): Promise<void>;
  getTenant(tenantId: string): Promise<XeroTenant | undefined>;
  listTenants(): Promise<XeroTenant[]>;
  savePayment(mapping: PaymentMapping): Promise<void>;
  findPaymentByInvoice(tenantId: string, invoiceId: string): Promise<PaymentMapping | undefined>;
  findPaymentByLink(paymentLinkUid: string): Promise<PaymentMapping | undefined>;
}

export class MemoryRepository implements Repository {
  private tokenSet: XeroTokenSet | undefined;

  private readonly tenants = new Map<string, XeroTenant>();

  private readonly paymentsByInvoice = new Map<string, PaymentMapping>();

  private readonly paymentsByLink = new Map<string, PaymentMapping>();

  async saveTokenSet(tokenSet: XeroTokenSet): Promise<void> {
    this.tokenSet = tokenSet;
  }

  async getTokenSet(): Promise<XeroTokenSet | undefined> {
    return this.tokenSet;
  }

  async saveTenant(tenant: XeroTenant): Promise<void> {
    this.tenants.set(tenant.tenantId, tenant);
  }

  async getTenant(tenantId: string): Promise<XeroTenant | undefined> {
    return this.tenants.get(tenantId);
  }

  async listTenants(): Promise<XeroTenant[]> {
    return [...this.tenants.values()];
  }

  async savePayment(mapping: PaymentMapping): Promise<void> {
    this.paymentsByInvoice.set(`${mapping.tenantId}:${mapping.invoiceId}`, mapping);
    this.paymentsByLink.set(mapping.paymentLinkUid, mapping);
  }

  async findPaymentByInvoice(
    tenantId: string,
    invoiceId: string,
  ): Promise<PaymentMapping | undefined> {
    return this.paymentsByInvoice.get(`${tenantId}:${invoiceId}`);
  }

  async findPaymentByLink(paymentLinkUid: string): Promise<PaymentMapping | undefined> {
    return this.paymentsByLink.get(paymentLinkUid);
  }
}
