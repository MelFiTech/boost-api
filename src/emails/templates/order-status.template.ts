import { escapeHtml, renderEmailLayout } from './layout';
import { renderEmailDetailsContainer } from './email-details.util';

import { EMAIL_COLORS as C } from './email-colors.util';

export interface OrderStatusTemplateData {
  orderId: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'partial';
  serviceName: string;
  platform: string;
  quantity: number;
  targetUrl: string;
  userName: string;
  orderDate: Date;
  completedDate?: Date;
  progress?: number;
  notes?: string;
}

const STATUS_META: Record<
  OrderStatusTemplateData['status'],
  { label: string; color: string; message: string }
> = {
  pending: {
    label: 'Received',
    color: C.accentAmber,
    message: 'We received your order and will start processing it shortly.',
  },
  processing: {
    label: 'In progress',
    color: C.accentBlue,
    message: 'Your order is being delivered. We will notify you when it completes.',
  },
  completed: {
    label: 'Completed',
    color: C.accentGreen,
    message: 'Great news. Your order has been completed successfully.',
  },
  cancelled: {
    label: 'Cancelled',
    color: C.accentRed,
    message: 'Your order was cancelled. Contact support if you need help.',
  },
  partial: {
    label: 'Partial',
    color: C.accentAmber,
    message: 'Your order was partially completed and may still be processing.',
  },
};

export function renderOrderStatusEmail(data: OrderStatusTemplateData): string {
  const meta = STATUS_META[data.status];
  const rows: Array<[string, string | number]> = [
    ['Service', data.serviceName],
    ['Platform', data.platform],
    ['Quantity', data.quantity.toLocaleString('en-NG')],
    ['Target', data.targetUrl],
    ['Order date', data.orderDate.toLocaleDateString('en-NG')],
  ];
  if (data.completedDate) {
    rows.push(['Completed', data.completedDate.toLocaleDateString('en-NG')]);
  }
  if (data.progress != null) {
    rows.push(['Progress', `${data.progress}%`]);
  }

  const notesBlock = data.notes
    ? `<p style="margin:20px 0 0;color:${C.textOnDark};font-size:13px;line-height:1.6;">${escapeHtml(data.notes)}</p>`
    : '';

  const bodyHtml = `
    <p style="margin:0 0 8px;color:${meta.color};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">${meta.label}</p>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.textOnDark};">Order #${escapeHtml(data.orderId.slice(-8).toUpperCase())}</h1>
    <p style="margin:0 0 24px;color:${C.textOnDark};font-size:15px;line-height:1.6;">
      Hi <strong style="color:${C.textOnDark};">${escapeHtml(data.userName)}</strong>, ${meta.message}
    </p>
    ${renderEmailDetailsContainer(rows)}
    ${notesBlock}`;

  return renderEmailLayout({
    title: `Order update: ${meta.label}`,
    preheader: `Order ${data.orderId} is ${meta.label.toLowerCase()}`,
    bodyHtml,
  });
}

export function orderStatusEmailSubject(data: OrderStatusTemplateData): string {
  const meta = STATUS_META[data.status];
  return `${meta.label}: Order #${data.orderId.slice(-8).toUpperCase()}`;
}
