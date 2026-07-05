import { escapeHtml, renderEmailLayout } from './layout';
import {
  formatEmailDate,
  formatEmailMoney,
  renderEmailDetailsContainer,
} from './email-details.util';

import { EMAIL_COLORS as C } from './email-colors.util';

export interface ElectricityTokenTemplateData {
  userName: string;
  token: string;
  meterNumber: string;
  amount: number;
  reference: string;
  date: Date;
  numberOfUnits?: string;
  providerName?: string;
}

export function renderElectricityTokenEmail(data: ElectricityTokenTemplateData): string {
  const rows: Array<[string, string | number | undefined]> = [
    ['Provider', data.providerName],
    ['Meter', data.meterNumber],
    ['Amount', formatEmailMoney(data.amount)],
    ['Units', data.numberOfUnits ? `${data.numberOfUnits} kWh` : undefined],
    ['Reference', data.reference],
    ['Date', formatEmailDate(data.date)],
  ];

  const bodyHtml = `
    <p style="margin:0 0 8px;color:${C.accentAmber};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">Prepaid electricity</p>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.textOnDark};">Your token is ready</h1>
    <p style="margin:0 0 24px;color:${C.textOnDark};font-size:15px;line-height:1.6;">
      Hi <strong style="color:${C.textOnDark};">${escapeHtml(data.userName)}</strong>, enter this token on your meter to load your units.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.bgCard};border-radius:12px;margin:0 0 24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 12px;color:${C.textOnDark};font-size:12px;text-transform:uppercase;letter-spacing:.12em;">Electricity token</p>
          <p style="margin:0;color:${C.textOnDark};font-size:28px;font-weight:700;letter-spacing:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.3;word-break:break-all;">${escapeHtml(data.token)}</p>
        </td>
      </tr>
    </table>
    ${renderEmailDetailsContainer(rows)}
    <p style="margin:20px 0 0;color:${C.textOnDark};font-size:13px;line-height:1.5;">
      Keep this token safe. You can also view it anytime in your BoostLab transaction history.
    </p>`;

  return renderEmailLayout({
    title: 'Your electricity token',
    preheader: `Token: ${data.token}`,
    bodyHtml,
  });
}

export function electricityTokenEmailSubject(data: ElectricityTokenTemplateData): string {
  return `Your electricity token: ${data.token}`;
}
