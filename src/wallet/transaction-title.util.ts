import { BillType, WalletTransactionCategory } from '@prisma/client';

export interface TransactionTitleInput {
  category: WalletTransactionCategory;
  narration?: string | null;
  metadata?: Record<string, unknown> | null;
  billPayment?: {
    billType: BillType;
    metadata?: Record<string, unknown> | null;
  } | null;
}

function readMetaString(metadata: Record<string, unknown> | null | undefined, key: string): string {
  const value = metadata?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function formatTvTitle(billerName?: string): string {
  if (!billerName) return 'TV subscription';

  const normalized = billerName.replace(/\s+SUBSCRIPTION\s*$/i, '').trim();
  const firstWord = normalized.split(/\s+/)[0] || normalized;

  if (/^dstv$/i.test(firstWord)) return 'DSTV Sub';
  if (/^gotv$/i.test(firstWord)) return 'GOtv Sub';
  if (/^startimes$/i.test(firstWord)) return 'StarTimes Sub';

  return `${firstWord} Sub`;
}

export function formatTransactionTitle(input: TransactionTitleInput): string {
  const meta = (input.metadata || {}) as Record<string, unknown>;
  const billMeta = (input.billPayment?.metadata || {}) as Record<string, unknown>;

  const cryptoToken = readMetaString(meta, 'cryptoToken') || readMetaString(meta, 'tokenSymbol');
  if (cryptoToken) {
    return `Sell ${cryptoToken.toUpperCase()}`;
  }

  switch (input.category) {
    case WalletTransactionCategory.WITHDRAWAL:
      return 'Withdrawal';
    case WalletTransactionCategory.REFUND:
      return 'Refund';
    case WalletTransactionCategory.FUNDING:
      return 'Wallet funding';
    case WalletTransactionCategory.BILL_PAYMENT: {
      const billType =
        input.billPayment?.billType ||
        (readMetaString(meta, 'billType') as BillType | undefined);
      const billerName =
        readMetaString(meta, 'billerName') || readMetaString(billMeta, 'billerName');

      switch (billType) {
        case BillType.AIRTIME:
          return 'Airtime purchase';
        case BillType.DATA:
          return 'Data Purchase';
        case BillType.ELECTRICITY:
          return 'Electricity';
        case BillType.TV:
          return formatTvTitle(billerName);
        default:
          if (billType === BillType.BETTING) return 'Betting';
          if (readMetaString(meta, 'billType').toUpperCase() === 'GIFTCARD') return 'Giftcard';
          return 'Bill payment';
      }
    }
    case WalletTransactionCategory.SMM_ORDER: {
      const platform = readMetaString(meta, 'platform');
      const service = readMetaString(meta, 'service');
      if (platform && service) return `${platform} ${service}`;
      return 'Boost order';
    }
    case WalletTransactionCategory.ADJUSTMENT:
      if (readMetaString(meta, 'source') === 'admin') {
        return 'Wallet top up';
      }
      return 'Adjustment';
    default:
      return input.narration?.trim() || 'Transaction';
  }
}
