import { escapeHtml, renderEmailLayout } from './layout';
import { EMAIL_COLORS as C } from './email-colors.util';

export interface OtpTemplateData {
  otp: string;
  userName?: string;
  expiryMinutes?: number;
}

export function renderOtpEmail(data: OtpTemplateData): string {
  const expiry = data.expiryMinutes ?? 10;
  const greeting = data.userName
    ? `Hi <strong style="color:${C.textOnDark};">${escapeHtml(data.userName)}</strong>,`
    : 'Hi there,';

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${C.textOnDark};letter-spacing:-0.02em;">Your login code</h1>
    <p style="margin:0 0 28px;color:${C.textOnDark};font-size:15px;line-height:1.6;">
      ${greeting}<br />
      Use this one-time code to sign in to BoostLab. It expires in ${expiry} minutes.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.bgCard};border-radius:12px;margin:0 0 28px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 12px;color:${C.textOnDark};font-size:12px;text-transform:uppercase;letter-spacing:.12em;">Verification code</p>
          <p style="margin:0;color:${C.textOnDark};font-size:40px;font-weight:700;letter-spacing:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.2;">${escapeHtml(data.otp)}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 20px;color:${C.textOnDark};font-size:13px;line-height:1.6;">
      <strong style="color:${C.accentOrange};">Security tip:</strong> Never share this code. BoostLab staff will never ask for it.
    </p>
    <p style="margin:0;color:${C.textOnDark};font-size:13px;line-height:1.5;">
      If you didn't request this code, you can safely ignore this email.
    </p>`;

  return renderEmailLayout({
    title: 'Your BoostLab login code',
    preheader: `Your BoostLab code is ${data.otp}`,
    bodyHtml,
    footerNote: 'This is an automated message. Please do not reply.',
  });
}
