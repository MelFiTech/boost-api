import { escapeHtml, renderEmailLayout } from './layout';
import {
  formatEmailDate,
  formatEmailMoney,
  renderEmailDetailsContainer,
} from './email-details.util';

import { EMAIL_COLORS as C } from './email-colors.util';

export interface TxnSuccessTemplateData {
  userName: string;
  title: string;
  amount: number;
  reference: string;
  date: Date;
  balanceAfter?: number;
  description?: string;
}

export function renderTxnSuccessEmail(data: TxnSuccessTemplateData): string {
  const rows: Array<[string, string | number | undefined]> = [
    ['Transaction', data.title],
    ['Amount', formatEmailMoney(data.amount)],
    ['Reference', data.reference],
    ['Date', formatEmailDate(data.date)],
    ['Balance', data.balanceAfter != null ? formatEmailMoney(data.balanceAfter) : undefined],
  ];

  const descriptionBlock = data.description
    ? `<p style="margin:0 0 24px;color:${C.textOnDark};font-size:15px;line-height:1.6;">${escapeHtml(data.description)}</p>`
    : `<p style="margin:0 0 24px;color:${C.textOnDark};font-size:15px;line-height:1.6;">
      Hi <strong style="color:${C.textOnDark};">${escapeHtml(data.userName)}</strong>, your payment was processed successfully.
    </p>`;

  const bodyHtml = `
    <p style="margin:0 0 8px;color:${C.accentGreen};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">Successful</p>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.textOnDark};">${escapeHtml(data.title)}</h1>
    ${descriptionBlock}
    ${renderEmailDetailsContainer(rows)}`;

  return renderEmailLayout({
    title: `Payment successful: ${data.title}`,
    preheader: `${data.title} of ${formatEmailMoney(data.amount)} was successful`,
    bodyHtml,
  });
}

export function txnSuccessEmailSubject(data: TxnSuccessTemplateData): string {
  return `Payment successful: ${data.title}`;
}
