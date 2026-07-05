import { getEmailLogoDarkSrc, getEmailLogoSrc } from '../email-assets.util';
import { EMAIL_COLORS as C } from './email-colors.util';

export interface EmailLayoutOptions {
  title: string;
  preheader?: string;
  bodyHtml: string;
  footerNote?: string;
}

const DARK_BG = C.bg;
const DARK_GRADIENT = 'linear-gradient(#0a0a0a,#0a0a0a)';
/** Near-white avoids Gmail/Apple dark-mode color inversion on #ffffff. */
const LIGHT_TEXT = C.textOnDark;

function darkBgStyle(extra = ''): string {
  return `background-color:${DARK_BG} !important;background-image:${DARK_GRADIENT} !important;${extra}`;
}

function renderLogoHtml(): string {
  const logoLime = getEmailLogoSrc();
  const logoDark = getEmailLogoDarkSrc();
  const imgStyle =
    'display:block;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;';

  if (logoLime && logoDark) {
    return `
              <img src="${logoLime}" alt="BoostLab" width="140" class="logo-lime" style="${imgStyle}" />
              <img src="${logoDark}" alt="BoostLab" width="140" class="logo-dark-wordmark" style="display:none;max-height:0;overflow:hidden;${imgStyle}" />`;
  }

  if (logoLime) {
    return `<img src="${logoLime}" alt="BoostLab" width="140" style="${imgStyle}" />`;
  }

  return `<div style="color:${C.accentLime};font-size:28px;font-weight:700;letter-spacing:-0.02em;">BoostLab</div>`;
}

/**
 * Shared email shell — forces dark background in light and dark system modes.
 * Lime logo on dark canvas; app dark-logo fallback if a client ignores the dark shell.
 */
export function renderEmailLayout(options: EmailLayoutOptions): string {
  const year = new Date().getFullYear();
  const preheader = options.preheader || options.title;
  const logoHtml = renderLogoHtml();
  const bg = darkBgStyle();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" style="${bg}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark only" />
  <meta name="supported-color-schemes" content="dark" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(options.title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style>
    body, table, td { background-color: ${DARK_BG} !important; }
  </style>
  <![endif]-->
  <!--[if gte mso 9]>
  <v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
    <v:fill type="tile" color="${DARK_BG}" />
  </v:background>
  <![endif]-->
  <style>
    :root { color-scheme: dark only; supported-color-schemes: dark; }
    html, body, .email-root, .email-root table, .email-root td, .email-bg, .email-shell {
      ${darkBgStyle()}
    }
    body, table, td, div, p, h1, h2, h3, li, span, a {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      min-height: 100vh !important;
    }
    .email-text, .email-text p, .email-text h1, .email-text h2, .email-text li, .email-text span,
    .email-text td, .email-text div, .email-text ul, .email-text strong {
      color: ${C.textOnDark} !important;
    }
    .preheader {
      display: none !important;
      visibility: hidden;
      opacity: 0;
      height: 0;
      width: 0;
      max-height: 0;
      overflow: hidden;
      mso-hide: all;
    }
    .logo-dark-wordmark { display: none !important; max-height: 0 !important; overflow: hidden !important; }
    .logo-lime { display: block !important; max-height: none !important; overflow: visible !important; }
    @media (prefers-color-scheme: light) {
      html, body, .email-root, .email-root table, .email-root td, .email-bg, .email-shell {
        ${darkBgStyle()}
      }
      .email-text, .email-text p, .email-text h1, .email-text h2, .email-text li, .email-text span,
      .email-text td, .email-text div, .email-text ul, .email-text strong, .email-text a {
        color: ${C.textOnDark} !important;
      }
      .logo-lime { display: block !important; max-height: none !important; overflow: visible !important; }
      .logo-dark-wordmark { display: none !important; max-height: 0 !important; overflow: hidden !important; }
    }
    @media (prefers-color-scheme: dark) {
      html, body, .email-root, .email-root table, .email-root td, .email-bg, .email-shell {
        ${darkBgStyle()}
      }
      .email-text, .email-text p, .email-text h1, .email-text h2, .email-text h3, .email-text li,
      .email-text span, .email-text td, .email-text div, .email-text ul, .email-text strong,
      .email-text a, .email-footer, .email-footer p {
        color: ${C.textOnDark} !important;
        -webkit-text-fill-color: ${C.textOnDark} !important;
      }
    }
    u + .body .email-text, u + .body .email-text p, u + .body .email-text td {
      color: ${C.textOnDark} !important;
    }
    @media only screen and (max-width: 620px) {
      .shell { width: 100% !important; }
      .content { padding: 28px 20px !important; }
    }
  </style>
</head>
<body class="email-root email-bg" style="margin:0;padding:0;width:100%;min-height:100vh;${bg}font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div class="preheader" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <div class="email-root" style="width:100%;min-height:100vh;${bg}">
    <table role="presentation" class="email-bg" width="100%" cellspacing="0" cellpadding="0" bgcolor="${DARK_BG}" style="width:100%;min-height:100vh;${bg}">
      <tr>
        <td align="center" class="email-bg" bgcolor="${DARK_BG}" style="${bg}padding:0;">
          <table role="presentation" class="shell email-shell" width="600" cellspacing="0" cellpadding="0" bgcolor="${DARK_BG}" style="max-width:600px;width:100%;${bg}">
            <tr>
              <td align="left" class="content email-bg" bgcolor="${DARK_BG}" style="padding:40px 32px;color:${LIGHT_TEXT};${bg}">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${DARK_BG}" style="${bg}">
                  <tr>
                    <td align="left" bgcolor="${DARK_BG}" style="padding-bottom:32px;${bg}">
                      ${logoHtml}
                    </td>
                  </tr>
                  <tr>
                    <td align="left" class="email-text" bgcolor="${DARK_BG}" style="color:${LIGHT_TEXT};${bg}">
                      ${options.bodyHtml}
                    </td>
                  </tr>
                  <tr>
                    <td align="left" class="email-text email-footer" bgcolor="${DARK_BG}" style="padding-top:40px;color:${C.textOnDark};font-size:12px;line-height:1.6;${bg}">
                      ${options.footerNote ? `<p style="margin:0 0 8px;color:${C.textOnDark} !important;">${escapeHtml(options.footerNote)}</p>` : ''}
                      <p style="margin:0;color:${C.textOnDark} !important;">© ${year} BoostLab · boostlab.ng</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
