export interface FundingAccountDetails {
  accountNumber: string;
  accountName: string;
  bankName: string;
  reference: string;
  expiresAt?: string;
  bankCode?: string;
  providerAccountId?: string;
  amount?: number;
  providerRail?: 'Safe_Haven' | 'Flutterwave';
}

export interface CreateFundingAccountParams {
  amount: number;
  currency: string;
  reference: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  customerBvn?: string;
  nameOnAccount?: string;
}

/** Handles moving money INTO the managed wallet (bank transfer, card, etc.) */
export interface FundingProvider {
  readonly name: string;
  createFundingAccount(params: CreateFundingAccountParams): Promise<FundingAccountDetails>;
}

export interface PayBillParams {
  billType: string; // AIRTIME | DATA | ELECTRICITY | TV | BETTING | INTERNET
  customerIdentifier: string; // phone, meter number, smartcard number
  billerCode?: string; // legacy: network or bundle/package id
  amount: number;
  reference: string;
  network?: string; // AIRTIME, DATA
  bundleId?: string; // DATA
  packageId?: string; // TV, ELECTRICITY
}

export interface PayBillResult {
  providerRef: string;
  status: 'COMPLETED' | 'PROCESSING' | 'FAILED';
  metadata?: Record<string, any>;
}

/** Fulfils bill payments (airtime, data, electricity, TV, ...) */
export interface BillsProvider {
  readonly name: string;
  payBill(params: PayBillParams): Promise<PayBillResult>;
}
