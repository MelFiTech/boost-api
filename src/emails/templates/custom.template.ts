import { escapeHtml, renderEmailLayout } from './layout';
import { EMAIL_COLORS as C } from './email-colors.util';

export interface CustomTemplateData {
  title: string;
  messageHtml: string;
  preheader?: string;
}

export function renderCustomEmail(data: CustomTemplateData): string {
  return renderEmailLayout({
    title: data.title,
    preheader: data.preheader || data.title,
    bodyHtml: `
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${C.textOnDark};">${escapeHtml(data.title)}</h1>
      <div style="color:${C.textOnDark};font-size:15px;line-height:1.7;">${data.messageHtml}</div>`,
  });
}
