import { escapeHtml, renderEmailLayout } from './layout';
import { formatEmailDate, renderEmailDetailsContainer } from './email-details.util';
import { EMAIL_COLORS as C } from './email-colors.util';

export interface KycVerificationTemplateData {
  userEmail: string;
  status: 'approved' | 'declined';
  rejectionReason?: string;
  reviewedAt?: Date;
}

export function kycVerificationEmailSubject(data: KycVerificationTemplateData): string {
  return data.status === 'approved'
    ? 'Your BoostLab verification was approved'
    : 'Your BoostLab verification was declined';
}

export function renderKycVerificationEmail(data: KycVerificationTemplateData): string {
  const isApproved = data.status === 'approved';
  const accent = isApproved ? C.accentLime : C.accentOrange;
  const label = isApproved ? 'Verification approved' : 'Verification declined';
  const headline = isApproved ? 'You are verified' : 'Verification not approved';
  const preheader = isApproved
    ? 'Your identity verification was approved'
    : 'Your identity verification was declined';

  const intro = isApproved
    ? `Your identity verification for <strong style="color:${C.textOnDark};">${escapeHtml(data.userEmail)}</strong> was approved. You can now fund your wallet, withdraw, and use all BoostLab features.`
    : `We could not approve the identity verification for <strong style="color:${C.textOnDark};">${escapeHtml(data.userEmail)}</strong>. Review the details below and submit again from the app if needed.`;

  const rows: Array<[string, string | undefined]> = [
    ['Status', isApproved ? 'Approved' : 'Declined'],
    ['Account', data.userEmail],
    ...(data.reviewedAt ? [['Reviewed', formatEmailDate(data.reviewedAt)] as [string, string]] : []),
    ...(!isApproved && data.rejectionReason
      ? [['Reason', data.rejectionReason] as [string, string]]
      : []),
  ];

  const footer = isApproved
    ? 'Open the BoostLab app to fund your wallet and get started.'
    : 'If you believe this was a mistake, contact us via Help &amp; Support in the app.';

  const bodyHtml = `
    <p style="margin:0 0 8px;color:${accent};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">${label}</p>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${C.textOnDark};">${headline}</h1>
    <p style="margin:0 0 24px;color:${C.textOnDark};font-size:15px;line-height:1.6;">
      ${intro}
    </p>
    ${renderEmailDetailsContainer(rows)}
    <p style="margin:20px 0 0;color:${C.textOnDark};font-size:13px;line-height:1.5;">
      ${footer}
    </p>`;

  return renderEmailLayout({
    title: headline,
    preheader,
    bodyHtml,
  });
}
