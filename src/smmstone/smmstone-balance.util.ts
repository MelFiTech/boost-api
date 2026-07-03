export const DEFAULT_SMMSTONE_LOW_BALANCE_THRESHOLD = 10;

export function parseSmmstoneBalance(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const candidate = obj.balance ?? obj.funds ?? obj.amount;
    if (candidate != null) return parseSmmstoneBalance(candidate);
  }
  return null;
}

export function isSmmstoneLowBalance(
  balance: number | null,
  threshold = DEFAULT_SMMSTONE_LOW_BALANCE_THRESHOLD,
): boolean {
  if (balance == null) return false;
  return balance < threshold;
}

/** SMMStone returns these when the provider wallet cannot cover the order. */
export function isSmmstoneInsufficientBalanceError(message?: string | null): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes('not enough') ||
    normalized.includes('insufficient') ||
    normalized.includes('low balance') ||
    normalized.includes('balance is low') ||
    normalized.includes('add funds') ||
    normalized.includes('deposit') ||
    (normalized.includes('balance') && normalized.includes('fund'))
  );
}

export const LOW_PROVIDER_BALANCE_ISSUE = 'LOW_PROVIDER_BALANCE';
