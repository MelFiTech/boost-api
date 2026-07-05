import { escapeHtml, renderEmailLayout } from './layout';
import {
  formatEmailDate,
  formatEmailMoney,
  renderEmailDetailsContainer,
} from './email-details.util';

import { EMAIL_COLORS as C } from './email-colors.util';

export interface OrderCompletionTemplateData {
  orderId: string;
  serviceName: string;
  platform: string;
  quantity: number;
  targetUrl: string;
  userName: string;
  completedDate: Date;
  amount?: number;
}

export function renderOrderCompletionEmail(data: OrderCompletionTemplateData): string {
  const orderRef = data.orderId.slice(-8).toUpperCase();
  const rows: Array<[string, string | number | undefined]> = [
    ['Service', data.serviceName],
    ['Platform', data.platform],
    ['Quantity', data.quantity.toLocaleString('en-NG')],
    ['Target', data.targetUrl],
    ['Completed', formatEmailDate(data.completedDate)],
  ];
  if (data.amount != null) {
    rows.push(['Amount', formatEmailMoney(data.amount)]);
  }

  const bodyHtml = `
    <p style="margin:0 0 8px;color:${C.accentGreen};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">Completed</p>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.textOnDark};">Order #${escapeHtml(orderRef)}</h1>
    <p style="margin:0 0 24px;color:${C.textOnDark};font-size:15px;line-height:1.6;">
      Hi <strong style="color:${C.textOnDark};">${escapeHtml(data.userName)}</strong>, your order has been delivered successfully.
    </p>
    ${renderEmailDetailsContainer(rows)}
    <p style="margin:20px 0 0;color:${C.textOnDark};font-size:13px;line-height:1.5;">
      Open the BoostLab app anytime to place another order or track your history.
    </p>`;

  return renderEmailLayout({
    title: `Order completed: #${orderRef}`,
    preheader: `Your ${data.platform} order is complete`,
    bodyHtml,
  });
}

export function orderCompletionEmailSubject(data: OrderCompletionTemplateData): string {
  return `Order completed: #${data.orderId.slice(-8).toUpperCase()}`;
}
