import { BillPayment, BillType, Prisma, TransactionStatus } from '@prisma/client';

export interface BillPaymentSummary {
  id: string;
  billType: BillType;
  customerIdentifier: string;
  amount: string;
  status: TransactionStatus;
  token?: string;
  numberOfUnits?: string;
  providerName?: string;
  createdAt?: string;
}

function readMetaString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function summarizeBillPayment(
  payment: Pick<
    BillPayment,
    'id' | 'billType' | 'customerIdentifier' | 'amount' | 'status' | 'metadata' | 'createdAt'
  >,
): BillPaymentSummary {
  const meta = (payment.metadata || {}) as Record<string, unknown>;
  const providerName =
    readMetaString(meta, 'billerName') || readMetaString(meta, 'provider');

  return {
    id: payment.id,
    billType: payment.billType,
    customerIdentifier: payment.customerIdentifier,
    amount: (payment.amount as Prisma.Decimal).toString(),
    status: payment.status,
    token: readMetaString(meta, 'token'),
    numberOfUnits: readMetaString(meta, 'number_of_units'),
    providerName,
    createdAt: payment.createdAt?.toISOString(),
  };
}
