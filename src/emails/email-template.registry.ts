import { renderCustomEmail } from './templates/custom.template';
import {
  electricityTokenEmailSubject,
  renderElectricityTokenEmail,
  ElectricityTokenTemplateData,
} from './templates/electricity-token.template';
import {
  orderCompletionEmailSubject,
  renderOrderCompletionEmail,
  OrderCompletionTemplateData,
} from './templates/order-completion.template';
import {
  orderStatusEmailSubject,
  renderOrderStatusEmail,
  OrderStatusTemplateData,
} from './templates/order-status.template';
import { renderOtpEmail, OtpTemplateData } from './templates/otp.template';
import {
  renderTxnSuccessEmail,
  txnSuccessEmailSubject,
  TxnSuccessTemplateData,
} from './templates/txn-success.template';
import {
  renderWalletTopUpEmail,
  walletTopUpEmailSubject,
  WalletTopUpTemplateData,
} from './templates/wallet-topup.template';
import {
  renderWithdrawalEmail,
  withdrawalEmailSubject,
  WithdrawalTemplateData,
} from './templates/withdrawal.template';
import { renderWelcomeEmail, WelcomeTemplateData } from './templates/welcome.template';
import {
  kycVerificationEmailSubject,
  renderKycVerificationEmail,
  KycVerificationTemplateData,
} from './templates/kyc-verification.template';

export type EmailTemplateSlug =
  | 'otp'
  | 'welcome'
  | 'kyc-approved'
  | 'kyc-declined'
  | 'order-status'
  | 'order-completion'
  | 'txn-success'
  | 'withdrawal'
  | 'wallet-topup'
  | 'electricity-token'
  | 'custom';

export interface EmailTemplateDefinition {
  slug: EmailTemplateSlug;
  name: string;
  description: string;
  subject: (sample?: boolean) => string;
  render: () => string;
}

const sampleOrderStatus: OrderStatusTemplateData = {
  orderId: 'cmr4sample0001',
  status: 'processing',
  serviceName: 'Instagram Followers',
  platform: 'Instagram',
  quantity: 1000,
  targetUrl: 'https://instagram.com/boostlab',
  userName: 'Alex',
  orderDate: new Date(),
  progress: 45,
};

const sampleOrderCompletion: OrderCompletionTemplateData = {
  orderId: 'cmr4sample0001',
  serviceName: 'Instagram Followers',
  platform: 'Instagram',
  quantity: 1000,
  targetUrl: 'https://instagram.com/boostlab',
  userName: 'Alex',
  completedDate: new Date(),
  amount: 4500,
};

const sampleTxnSuccess: TxnSuccessTemplateData = {
  userName: 'Alex',
  title: 'Airtime purchase',
  amount: 1000,
  reference: 'TXN-8F3A92C1',
  date: new Date(),
  balanceAfter: 12500,
};

const sampleWithdrawal: WithdrawalTemplateData = {
  userName: 'Alex',
  amount: 5000,
  fee: 50,
  totalDebited: 5050,
  bankName: 'GTBank',
  accountNumber: '0123456789',
  accountName: 'Alex Johnson',
  reference: 'WDR-7B2E91D4',
  date: new Date(),
  balanceAfter: 7450,
};

const sampleWalletTopUp: WalletTopUpTemplateData = {
  userName: 'Alex',
  amount: 10000,
  fee: 50,
  creditedAmount: 9950,
  reference: 'FND-4C8A21E6',
  date: new Date(),
  balanceAfter: 19950,
  paymentMethod: 'Bank transfer',
};

const sampleElectricityToken: ElectricityTokenTemplateData = {
  userName: 'Alex',
  token: '1234-5678-9012',
  meterNumber: '12345678901',
  amount: 5000,
  reference: 'TXN-01JABCDEF',
  date: new Date(),
  numberOfUnits: '45.2',
  providerName: 'IKEDC',
};

export const EMAIL_TEMPLATES: EmailTemplateDefinition[] = [
  {
    slug: 'otp',
    name: 'OTP / Login code',
    description: 'Sent when a user requests a sign-in code (production only).',
    subject: () => 'Your BoostLab login code',
    render: () =>
      renderOtpEmail({ otp: '482913', userName: 'Alex', expiryMinutes: 10 }),
  },
  {
    slug: 'welcome',
    name: 'Welcome',
    description: 'Sent to new users after their first OTP request.',
    subject: () => 'Welcome to BoostLab',
    render: () =>
      renderWelcomeEmail({ userEmail: 'alex@example.com' }),
  },
  {
    slug: 'kyc-approved',
    name: 'KYC approved',
    description: 'Sent when admin approves a user identity verification.',
    subject: () =>
      kycVerificationEmailSubject({
        userEmail: 'alex@example.com',
        status: 'approved',
      }),
    render: () =>
      renderKycVerificationEmail({
        userEmail: 'alex@example.com',
        status: 'approved',
        reviewedAt: new Date(),
      }),
  },
  {
    slug: 'kyc-declined',
    name: 'KYC declined',
    description: 'Sent when admin declines verification or automated checks fail.',
    subject: () =>
      kycVerificationEmailSubject({
        userEmail: 'alex@example.com',
        status: 'declined',
      }),
    render: () =>
      renderKycVerificationEmail({
        userEmail: 'alex@example.com',
        status: 'declined',
        rejectionReason: 'BVN and NIN name details did not match.',
        reviewedAt: new Date(),
      }),
  },
  {
    slug: 'order-status',
    name: 'Order status update',
    description: 'Sent when an order moves through pending, processing, or cancelled.',
    subject: () => orderStatusEmailSubject(sampleOrderStatus),
    render: () => renderOrderStatusEmail(sampleOrderStatus),
  },
  {
    slug: 'order-completion',
    name: 'Order completion',
    description: 'Sent when a social boost order is fully delivered.',
    subject: () => orderCompletionEmailSubject(sampleOrderCompletion),
    render: () => renderOrderCompletionEmail(sampleOrderCompletion),
  },
  {
    slug: 'txn-success',
    name: 'Transaction success',
    description: 'Sent after a successful bill payment or wallet debit.',
    subject: () => txnSuccessEmailSubject(sampleTxnSuccess),
    render: () => renderTxnSuccessEmail(sampleTxnSuccess),
  },
  {
    slug: 'withdrawal',
    name: 'Withdrawal',
    description: 'Sent when a user withdraws funds to their bank account.',
    subject: () => withdrawalEmailSubject(sampleWithdrawal),
    render: () => renderWithdrawalEmail(sampleWithdrawal),
  },
  {
    slug: 'wallet-topup',
    name: 'Wallet top up',
    description: 'Sent when a wallet funding payment is confirmed.',
    subject: () => walletTopUpEmailSubject(sampleWalletTopUp),
    render: () => renderWalletTopUpEmail(sampleWalletTopUp),
  },
  {
    slug: 'electricity-token',
    name: 'Electricity token',
    description: 'Sent when prepaid electricity vending completes and the token is ready.',
    subject: () => electricityTokenEmailSubject(sampleElectricityToken),
    render: () => renderElectricityTokenEmail(sampleElectricityToken),
  },
  {
    slug: 'custom',
    name: 'Custom / Admin notify',
    description: 'Generic layout for admin customer notifications.',
    subject: () => 'Update on your BoostLab order',
    render: () =>
      renderCustomEmail({
        title: 'Update on your order',
        messageHtml:
          '<p>Hi,</p><p>We are reaching out about your Instagram order. Our team is looking into it and will make sure it is resolved.</p><p>BoostLab Support</p>',
      }),
  },
];

export function getEmailTemplate(slug: string): EmailTemplateDefinition | undefined {
  return EMAIL_TEMPLATES.find((t) => t.slug === slug);
}

export type {
  OtpTemplateData,
  WelcomeTemplateData,
  KycVerificationTemplateData,
  OrderStatusTemplateData,
  OrderCompletionTemplateData,
  TxnSuccessTemplateData,
  WithdrawalTemplateData,
  WalletTopUpTemplateData,
  ElectricityTokenTemplateData,
};
