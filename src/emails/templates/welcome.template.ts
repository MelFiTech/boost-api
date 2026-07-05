import { escapeHtml, renderEmailLayout } from './layout';
import { getWelcomeBannerSrc } from '../email-assets.util';
import { EMAIL_COLORS as C } from './email-colors.util';

export interface WelcomeTemplateData {
  userEmail: string;
}

function renderWelcomeHero(): string {
  const bannerSrc = getWelcomeBannerSrc();
  if (bannerSrc) {
    return `
    <img
      src="${bannerSrc}"
      alt="Welcome to BoostLab"
      width="600"
      style="display:block;width:100%;max-width:600px;height:auto;border-radius:12px;margin:0 0 28px;border:0;" />`;
  }

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;background:${C.bgCard};border-radius:12px;">
      <tr>
        <td style="padding:36px 28px;text-align:center;">
          <p style="margin:0 0 10px;color:${C.accentLime};font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;">You are all set</p>
          <p style="margin:0;color:${C.textOnDark};font-size:26px;font-weight:700;line-height:1.3;letter-spacing:-0.02em;">Welcome aboard</p>
        </td>
      </tr>
    </table>`;
}

export function renderWelcomeEmail(data: WelcomeTemplateData): string {
  const bodyHtml = `
    ${renderWelcomeHero()}
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${C.textOnDark};">Welcome to BoostLab</h1>
    <p style="margin:0 0 24px;color:${C.textOnDark};font-size:15px;line-height:1.6;">
      Hi there,<br />
      Your account <strong style="color:${C.textOnDark};">${escapeHtml(data.userEmail)}</strong> is ready.
      Boost your socials, pay bills, and manage your wallet, all in one app.
    </p>
    <p style="margin:0 0 12px;color:${C.textOnDark};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">What you can do</p>
    <ul style="margin:0 0 24px;padding-left:18px;color:${C.textOnDark};font-size:14px;line-height:1.8;">
      <li>Boost Instagram, TikTok, YouTube &amp; more</li>
      <li>Pay airtime, data, TV &amp; electricity</li>
      <li>Fund your wallet and track transactions</li>
    </ul>
    <p style="margin:0;color:${C.textOnDark};font-size:13px;line-height:1.5;">Need help? Open the app and reach us via Help &amp; Support.</p>`;

  return renderEmailLayout({
    title: 'Welcome to BoostLab',
    preheader: 'Your BoostLab account is ready',
    bodyHtml,
  });
}
