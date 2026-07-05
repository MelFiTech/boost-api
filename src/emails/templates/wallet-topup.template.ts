import { escapeHtml, renderEmailLayout } from './layout';
import {
  formatEmailDate,
  formatEmailMoney,
  renderEmailDetailsContainer,
} from './email-details.util';
import { EMAIL_COLORS as C } from './email-colors.util';

export interface WalletTopUpTemplateData {
  userName: string;
  amount: number;
  fee?: number;
  creditedAmount: number;
  reference: string;
  date: Date;
  balanceAfter?: number;
  paymentMethod?: string;
}

export function renderWalletTopUpEmail(data: WalletTopUpTemplateData): string {
  const rows: Array<[string, string | number | undefined]> = [
    ['Amount paid', formatEmailMoney(data.amount)],
    ['Fee', data.fee != null && data.fee > 0 ? formatEmailMoney(data.fee) : undefined],
    ['Credited', formatEmailMoney(data.creditedAmount)],
    ['Method', data.paymentMethod],
    ['Reference', data.reference],
    ['Date', formatEmailDate(data.date)],
    ['Balance', data.balanceAfter != null ? formatEmailMoney(data.balanceAfter) : undefined],
  ];

  const bodyHtml = `
    <p style="margin:0 0 8px;color:${C.accentGreen};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">Wallet funded</p>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.textOnDark};">Top up successful</h1>
    <p style="margin:0 0 24px;color:${C.textOnDark};font-size:15px;line-height:1.6;">
      Hi <strong style="color:${C.textOnDark};">${escapeHtml(data.userName)}</strong>, your wallet has been credited and is ready to use.
    </p>
    ${renderEmailDetailsContainer(rows)}
    <p style="margin:20px 0 0;color:${C.textOnDark};font-size:13px;line-height:1.5;">
      You can now pay bills, boost your socials, or withdraw anytime from the app.
    </p>`;

  return renderEmailLayout({
    title: 'Wallet funded successfully',
    preheader: `${formatEmailMoney(data.creditedAmount)} added to your wallet`,
    bodyHtml,
  });
}

export function walletTopUpEmailSubject(data: WalletTopUpTemplateData): string {
  return `Wallet funded: ${formatEmailMoney(data.creditedAmount)}`;
}
