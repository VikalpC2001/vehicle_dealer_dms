import { config } from '../config';

/**
 * Shared HTML layout for every email the app sends, styled after the frontend theme
 * (`RTO-Super-Admin/src/index.css`): brand gradient header, white rounded card on the light
 * background, the theme's text/border colours and the gradient primary button.
 *
 * Mail clients strip `<style>` blocks, CSS variables and most modern layout, so everything here is
 * table-based with inline styles and solid-colour fallbacks (Outlook ignores gradients and radii).
 * Callers pass plain text only — every dynamic value is HTML-escaped in this file.
 */

/** Frontend `@theme` tokens, inlined. */
const THEME = {
  background: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  muted: '#f1f5f9',
  foreground: '#0f172a',
  mutedForeground: '#64748b',
  primary: '#2563eb',
  headerGradient: 'linear-gradient(135deg,#2563eb 0%,#3b82f6 50%,#60a5fa 100%)',
  buttonGradient: 'linear-gradient(135deg,#2563eb 0%,#3b82f6 100%)',
} as const;

const FONT_STACK =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO_STACK = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

/** Accent used by the status pill and the highlighted note. */
export type EmailTone = 'primary' | 'success' | 'danger';

/** Tinted pill/note colours per tone (solid equivalents of the app's badge tints). */
const TONES: Record<EmailTone, { text: string; background: string; border: string }> = {
  primary: { text: '#1d4ed8', background: '#eff6ff', border: '#bfdbfe' },
  success: { text: '#047857', background: '#ecfdf5', border: '#a7f3d0' },
  danger: { text: '#b91c1c', background: '#fef2f2', border: '#fecaca' },
};

/** What one email says. All fields are plain text; escaping happens in {@link renderEmailHtml}. */
export interface EmailContent {
  /** Short line shown beside the subject in the inbox list (hidden inside the email). */
  preheader: string;
  /** Small status pill above the heading, e.g. "Approved". */
  badge?: { label: string; tone: EmailTone };
  /** Heading. */
  title: string;
  /** One or two short sentences under the heading. */
  message: string;
  /** One-time code, shown large in a code box. */
  code?: string;
  /** Primary button. The URL is also printed below it for clients that block buttons. */
  action?: { label: string; url: string };
  /** Highlighted box, e.g. a rejection reason. Line breaks in `text` are kept. */
  note?: { label: string; text: string; tone: EmailTone };
  /** Small muted line at the bottom of the card, e.g. an expiry. */
  hint?: string;
}

/**
 * Escapes a value for use in HTML text or a double-quoted attribute.
 *
 * @param value - Untrusted text (names, reasons, URLs).
 * @returns The text with `& < > " '` replaced by entities.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Invisible filler after the preheader so the inbox preview doesn't run on into the body text. */
const PREHEADER_FILLER = '&#847;&zwnj;&nbsp;'.repeat(60);

/** Empty row holding a vertical gap — Outlook (Word engine) only honours spacing on table cells. */
function spacerRow(height: number): string {
  return (
    `<tr><td height="${height}" style="height:${height}px;font-size:${height}px;line-height:${height}px;` +
    `mso-line-height-rule:exactly;">&nbsp;</td></tr>`
  );
}

function renderBadge(badge: NonNullable<EmailContent['badge']>): string {
  const tone = TONES[badge.tone];
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td style="padding:4px 12px;border:1px solid ${tone.border};border-radius:999px;background-color:${tone.background};` +
    `font-family:${FONT_STACK};font-size:12px;line-height:16px;font-weight:600;color:${tone.text};">` +
    `${escapeHtml(badge.label)}</td></tr>${spacerRow(16)}</table>`
  );
}

function renderCode(code: string): string {
  // `padding-left` equals the letter-spacing so the trailing gap doesn't push the code off-centre.
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${spacerRow(24)}<tr>` +
    `<td align="center" style="padding:20px 12px;border:1px solid ${THEME.border};border-radius:12px;background-color:${THEME.muted};">` +
    `<span class="email-code" style="display:inline-block;padding-left:10px;font-family:${MONO_STACK};font-size:34px;` +
    `line-height:40px;font-weight:700;letter-spacing:10px;color:${THEME.foreground};">${escapeHtml(code)}</span>` +
    `</td></tr></table>`
  );
}

function renderAction(action: NonNullable<EmailContent['action']>): string {
  const url = escapeHtml(action.url);
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0">${spacerRow(24)}<tr>` +
    // Outlook ignores padding on <a>, so it gets the same padding on the cell (`mso-padding-alt`).
    `<td align="center" bgcolor="${THEME.primary}" style="border-radius:8px;background-color:${THEME.primary};` +
    `background-image:${THEME.buttonGradient};mso-padding-alt:12px 28px;">` +
    `<a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 28px;font-family:${FONT_STACK};` +
    `font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">` +
    `${escapeHtml(action.label)}</a></td></tr></table>` +
    `<p style="margin:16px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:18px;color:${THEME.mutedForeground};` +
    `word-break:break-all;">Or open this link: <a href="${url}" target="_blank" rel="noopener" ` +
    `style="color:${THEME.primary};text-decoration:underline;">${url}</a></p>`
  );
}

function renderNote(note: NonNullable<EmailContent['note']>): string {
  const tone = TONES[note.tone];
  const text = escapeHtml(note.text).replace(/\r?\n/g, '<br>');
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${spacerRow(24)}<tr>` +
    `<td style="padding:14px 16px;border:1px solid ${tone.border};border-radius:12px;background-color:${tone.background};` +
    `font-family:${FONT_STACK};font-size:14px;line-height:22px;color:${THEME.foreground};word-break:break-word;overflow-wrap:anywhere;">` +
    `<p style="margin:0 0 2px;font-family:${FONT_STACK};font-size:12px;line-height:16px;font-weight:600;color:${tone.text};">` +
    `${escapeHtml(note.label)}</p>${text}</td></tr></table>`
  );
}

/**
 * Renders the themed HTML body for one email.
 *
 * @param content - What the email says (plain text; escaped here).
 * @returns A complete HTML document ready to pass as the `html` part.
 */
export function renderEmailHtml(content: EmailContent): string {
  const appName = escapeHtml(config.APP_NAME);
  const monogram = escapeHtml((Array.from(config.APP_NAME.trim())[0] ?? '').toUpperCase());

  const body =
    (content.badge ? renderBadge(content.badge) : '') +
    `<h1 style="margin:0;font-family:${FONT_STACK};font-size:22px;line-height:30px;font-weight:700;color:${THEME.foreground};` +
    `word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(content.title)}</h1>` +
    `<p style="margin:8px 0 0;font-family:${FONT_STACK};font-size:15px;line-height:24px;color:${THEME.mutedForeground};` +
    `word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(content.message)}</p>` +
    (content.code ? renderCode(content.code) : '') +
    (content.action ? renderAction(content.action) : '') +
    (content.note ? renderNote(content.note) : '') +
    (content.hint
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${spacerRow(24)}` +
        `<tr><td style="padding:16px 0 0;border-top:1px solid ${THEME.border};font-family:${FONT_STACK};` +
        `font-size:13px;line-height:20px;color:${THEME.mutedForeground};">${escapeHtml(content.hint)}</td></tr></table>`
      : '');

  return (
    `<!DOCTYPE html>` +
    `<html lang="en" dir="ltr"><head>` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="color-scheme" content="light">` +
    `<meta name="supported-color-schemes" content="light">` +
    `<title>${escapeHtml(content.title)}</title>` +
    // Inter where the client loads web fonts (Apple Mail); Outlook must not see it or it falls
    // back to Times New Roman, so it gets Arial explicitly.
    `<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&amp;display=swap" rel="stylesheet"><!--<![endif]-->` +
    `<!--[if mso]><style>table,td,h1,p,a,span{font-family:Arial,sans-serif !important;}</style><![endif]-->` +
    `<style>:root{color-scheme:light;}` +
    `@media only screen and (max-width:600px){.email-pad{padding:24px 20px !important;}` +
    `.email-head{padding:20px !important;}.email-code{font-size:28px !important;letter-spacing:6px !important;padding-left:6px !important;}}` +
    `</style></head>` +
    `<body style="margin:0;padding:0;background-color:${THEME.background};-webkit-text-size-adjust:100%;">` +
    `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${THEME.background};">` +
    `${escapeHtml(content.preheader)}${PREHEADER_FILLER}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${THEME.background};"><tr>` +
    `<td align="center" style="padding:32px 16px;">` +
    // Outlook ignores max-width, so it gets a fixed-width wrapper.
    `<!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;">` +
    // Card
    `<tr><td style="border:1px solid ${THEME.border};border-radius:16px;background-color:${THEME.card};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    // Brand header
    `<tr><td class="email-head" bgcolor="${THEME.primary}" style="padding:24px 32px;border-radius:15px 15px 0 0;` +
    `background-color:${THEME.primary};background-image:${THEME.headerGradient};">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;border-radius:12px;` +
    `background-color:#5a8cf0;background-color:rgba(255,255,255,0.2);font-family:${FONT_STACK};font-size:20px;` +
    `line-height:40px;font-weight:700;color:#ffffff;">${monogram}</td>` +
    `<td valign="middle" style="padding-left:12px;font-family:${FONT_STACK};font-size:20px;line-height:28px;font-weight:700;` +
    `color:#ffffff;">${appName}</td>` +
    `</tr></table></td></tr>` +
    // Content
    `<tr><td class="email-pad" style="padding:32px;">${body}</td></tr>` +
    `</table></td></tr>` +
    // Footer
    `<tr><td align="center" style="padding:20px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:18px;` +
    `color:${THEME.mutedForeground};">Automated message from ${appName}. Please&nbsp;do&nbsp;not&nbsp;reply.</td></tr>` +
    `</table>` +
    `<!--[if mso]></td></tr></table><![endif]-->` +
    `</td></tr></table></body></html>`
  );
}
