import { escapeHtml, renderEmailLayout } from './layout';
import {
  formatEmailDate,
  formatEmailMoney,
  renderEmailDetailsContainer,
} from './email-details.util';
import { EMAIL_COLORS as C } from './email-colors.util';

export interface WithdrawalTemplateData {
  userName: string;
  amount: number;
  fee: number;
  totalDebited: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  reference: string;
  date: Date;
  balanceAfter?: number;
}

export function renderWithdrawalEmail(data: WithdrawalTemplateData): string {
  const maskedAccount =
    data.accountNumber.length > 4
      ? `${'*'.repeat(Math.max(0, data.accountNumber.length - 4))}${data.accountNumber.slice(-4)}`
      : data.accountNumber;

  const rows: Array<[string, string | number | undefined]> = [
    ['Amount', formatEmailMoney(data.amount)],
    ['Fee', formatEmailMoney(data.fee)],
    ['Total debited', formatEmailMoney(data.totalDebited)],
    ['Bank', data.bankName],
    ['Account', maskedAccount],
    ['Account name', data.accountName],
    ['Reference', data.reference],
    ['Date', formatEmailDate(data.date)],
    ['Balance', data.balanceAfter != null ? formatEmailMoney(data.balanceAfter) : undefined],
  ];

  const bodyHtml = `
    <p style="margin:0 0 8px;color:${C.accentBlue};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">Withdrawal</p>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.textOnDark};">Withdrawal initiated</h1>
    <p style="margin:0 0 24px;color:${C.textOnDark};font-size:15px;line-height:1.6;">
      Hi <strong style="color:${C.textOnDark};">${escapeHtml(data.userName)}</strong>, we are processing your withdrawal to ${escapeHtml(data.bankName)}.
    </p>
    ${renderEmailDetailsContainer(rows)}
    <p style="margin:20px 0 0;color:${C.textOnDark};font-size:13px;line-height:1.5;">
      Funds usually arrive within a few minutes. Contact support if you do not receive them.
    </p>`;

  return renderEmailLayout({
    title: 'Withdrawal successful',
    preheader: `Withdrawal of ${formatEmailMoney(data.amount)} is being processed`,
    bodyHtml,
  });
}

export function withdrawalEmailSubject(data: WithdrawalTemplateData): string {
  return `Withdrawal successful: ${formatEmailMoney(data.amount)}`;
}
