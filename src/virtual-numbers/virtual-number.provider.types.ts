import { FleexaSmsServer } from '@prisma/client';
import { FleexaSmsServerSlug } from './fleexa/fleexa.types';

export const VIRTUAL_NUMBER_PROVIDER_SLUGS = ['fleexa'] as const;
export type VirtualNumberProviderSlug = (typeof VIRTUAL_NUMBER_PROVIDER_SLUGS)[number];

export function fleexaServerToSlug(server: FleexaSmsServer): FleexaSmsServerSlug {
  switch (server) {
    case FleexaSmsServer.SMS2:
      return 'sms2';
    case FleexaSmsServer.SMS3:
      return 'sms3';
    case FleexaSmsServer.SMS1:
    default:
      return 'sms';
  }
}

export function slugToFleexaServer(slug: FleexaSmsServerSlug): FleexaSmsServer {
  switch (slug) {
    case 'sms2':
      return FleexaSmsServer.SMS2;
    case 'sms3':
      return FleexaSmsServer.SMS3;
    case 'sms':
    default:
      return FleexaSmsServer.SMS1;
  }
}

export interface VirtualNumberProviderAdapter {
  readonly slug: VirtualNumberProviderSlug;
  readonly displayName: string;
  getBalance(): Promise<number>;
}
