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

export function buildNyraFundingRequest(
  rail: NyraFundingRail,
  params: CreateFundingAccountParams,
  expiresIn: number,
): NyraCreateFundingAccountRequest {
  const { firstname, lastname } = splitCustomerName(params.customerName);
  const customerName = params.customerName?.trim() || `${firstname} ${lastname}`;
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
        customer_name: customerName,
        customer_email: email,
        ...(params.nameOnAccount ? { name_on_account: params.nameOnAccount } : {}),
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
      customer_name: customerName,
      ...(params.nameOnAccount ? { name_on_account: params.nameOnAccount } : {}),
    },
  };
}
