import { escapeHtml } from './layout';
import { EMAIL_COLORS as C } from './email-colors.util';

export function formatEmailMoney(amount: number): string {
  return `₦${Math.abs(amount).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatEmailDate(date: Date): string {
  return date.toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function renderEmailDetailsContainer(
  rows: Array<[string, string | number | undefined | null]>,
): string {
  const tableRows = rows
    .filter(([, value]) => value !== '' && value != null)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 0;color:${C.textOnDark};font-size:13px;width:120px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:8px 0;color:${C.textOnDark};font-size:14px;word-break:break-all;">${escapeHtml(String(value))}</td></tr>`,
    )
    .join('');

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.bgCard};border-radius:12px;">
    <tr>
      <td style="padding:20px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          ${tableRows}
        </table>
      </td>
    </tr>
  </table>`;
}
