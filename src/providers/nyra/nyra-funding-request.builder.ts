import { CreateFundingAccountParams } from '../provider.types';
import {
  NyraCreateFundingAccountRequest,
  NyraFundingRail,
} from './nyra.types';

export function splitCustomerName(name?: string): { firstname: string; lastname: string } {
  const trimmed = name?.trim();
  if (!trimmed) {
    return { firstname: 'Boostlab', lastname: 'Customer' };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstname: parts[0], lastname: parts[0] };
  }

  return { firstname: parts[0], lastname: parts.slice(1).join(' ') };
}

/** Virtual accounts are always created in the business name, never the end user's. */
export const NYRA_BUSINESS_ACCOUNT_NAME = 'Boostlab';

export function buildNyraFundingRequest(
  rail: NyraFundingRail,
  params: CreateFundingAccountParams,
  expiresIn: number,
): NyraCreateFundingAccountRequest {
  const businessName = NYRA_BUSINESS_ACCOUNT_NAME;
  const { firstname, lastname } = splitCustomerName(businessName);
  const email = params.customerEmail;

  const base: NyraCreateFundingAccountRequest = {
    external_reference: params.reference,
    account_kind: 'dynamic',
    provider: rail,
    amount: Math.round(params.amount),
    expiresIn,
  };

  if (rail === 'Flutterwave') {
    return {
      ...base,
      meta: {
        customer_name: businessName,
        customer_email: email,
        name_on_account: businessName,
        flutterwave: {
          email,
          firstname,
          lastname,
          ...(params.customerPhone ? { phonenumber: params.customerPhone } : {}),
          ...(params.customerBvn ? { bvn: params.customerBvn } : {}),
        },
      },
    };
  }

  return {
    ...base,
    meta: {
      customer_email: email,
      customer_name: businessName,
      name_on_account: businessName,
    },
  };
}
