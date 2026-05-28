import { createPaymentLinkForInvoice } from './makepay.js';
import {
  createInvoicePayment,
  getInvoice,
  refreshTokenSet,
} from './xero.js';
import type { AppConfig, PaymentMapping } from './types.js';
import type { Repository } from './storage.js';

export async function createLinkForInvoice(
  config: AppConfig,
  repository: Repository,
  tenantId: string,
  invoiceId: string,
): Promise<PaymentMapping> {
  const existing = await repository.findPaymentByInvoice(tenantId, invoiceId);
  if (existing) {
    return existing;
  }

  const tenant = await repository.getTenant(tenantId);
  const tokenSet = await repository.getTokenSet();
  if (!tenant || !tokenSet) {
    throw new Error('Xero tenant is not connected.');
  }

  const freshTokenSet = await refreshTokenSet(config, repository, tokenSet);
  const invoice = await getInvoice(freshTokenSet, tenantId, invoiceId);
  const link = await createPaymentLinkForInvoice(config, tenantId, invoice);
  const mapping: PaymentMapping = {
    tenantId,
    invoiceId,
    paymentLinkUid: link.uid,
    paymentUrl: link.paymentUrl,
    amount: link.amount,
    status: 'created',
    createdAt: new Date().toISOString(),
  };
  await repository.savePayment(mapping);
  return mapping;
}

export async function reconcilePaidPayment(
  config: AppConfig,
  repository: Repository,
  paymentLinkUid: string,
): Promise<PaymentMapping | undefined> {
  const mapping = await repository.findPaymentByLink(paymentLinkUid);
  if (!mapping || mapping.status === 'paid') {
    return mapping;
  }

  const tokenSet = await repository.getTokenSet();
  if (!tokenSet) {
    return undefined;
  }

  const freshTokenSet = await refreshTokenSet(config, repository, tokenSet);
  const invoice = await getInvoice(freshTokenSet, mapping.tenantId, mapping.invoiceId);
  await createInvoicePayment(
    config,
    freshTokenSet,
    mapping.tenantId,
    invoice,
    mapping.amount,
    paymentLinkUid,
  );

  const paidMapping: PaymentMapping = {
    ...mapping,
    status: 'paid',
    paidAt: new Date().toISOString(),
  };
  await repository.savePayment(paidMapping);
  return paidMapping;
}
