import { createHash } from 'crypto';

export function hashSensitiveValue(value: string): string {
  return createHash('sha256').update(value.trim()).digest('hex');
}

export function normalizeNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

/**
 * Returns true when at least `minMatch` name tokens from the account name
 * appear in BOTH the BVN and NIN identity name token sets.
 */
export function accountNameMatchesIdentity(
  accountName: string,
  bvnNames: string[],
  ninNames: string[],
  minMatch = 2,
): boolean {
  const accountTokens = normalizeNameTokens(accountName);
  if (accountTokens.length === 0 || bvnNames.length === 0 || ninNames.length === 0) {
    return false;
  }

  const bvnSet = new Set(bvnNames);
  const ninSet = new Set(ninNames);
  const bvnMatches = accountTokens.filter((token) => bvnSet.has(token)).length;
  const ninMatches = accountTokens.filter((token) => ninSet.has(token)).length;

  return bvnMatches >= minMatch && ninMatches >= minMatch;
}
