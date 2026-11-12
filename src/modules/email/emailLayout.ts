/**
 * Shared HTML shell for every email, mirroring the app's auth screens: a dark brand card
 * (logo, mono eyebrow, wordmark) over a plain page, then a heavy title, muted copy and a
 * full-width pill button. Token values come from pwa/src/styles/tokens.css, copied as hex
 * because email clients cannot read CSS variables or load the app's font (it falls back
 * to the system UI font).
 */

const LOGO_BASE = 'https://s3.shivamingale.com/shivamingale/pi-vault/assets/logo';
/** Light-coloured glyph, for dark backgrounds. */
export const LOGO_ON_DARK = `${LOGO_BASE}/dark.png`;
/** Dark glyph, for light backgrounds. */
export const LOGO_ON_LIGHT = `${LOGO_BASE}/light.png`;

const palette = {
  light: {
    page: '#ffffff',
    surface: '#f5f4f1',
    fg: '#101010',
    muted: '#77746e',
    subtle: '#a09d97',
    btnBg: '#101010',
    btnFg: '#fefefe',
  },
  dark: {
    page: '#101215',
    surface: '#1c1f23',
    fg: '#f2f1ee',
    muted: '#9b9ca1',
    subtle: '#9b9ca1',
    btnBg: '#f2f1ee',
    btnFg: '#101215',
  },
} as const;

const HERO_BG = '#0e0f11';
const HERO_FG = '#fdfdfd';
const HERO_MUTED = '#9b9ca1';
const FONT = "'Plus Jakarta Sans',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
const L = palette.light;
const D = palette.dark;

/** Light is inlined (works everywhere); dark overrides by class where the client supports it. */
const DARK_CSS = `
  .bg-page{background:${D.page}!important}
  .bg-surface{background:${D.surface}!important}
  .t-fg{color:${D.fg}!important}
  .t-muted{color:${D.muted}!important}
  .t-subtle{color:${D.subtle}!important}
  .btn{background:${D.btnBg}!important}
  .btn a{color:${D.btnFg}!important}
  .logo-light{display:none!important}
  .logo-dark{display:block!important}`;

export interface EmailLayoutOptions {
  appName: string;
  /** Hidden inbox preview text. Pre-escaped. */
  preheader: string;
  title: string;
  /** Paragraph HTML, pre-escaped by the caller. */
  body: string;
  cta?: { label: string; href: string };
  /** Optional soft note card (security reassurance, expiry). Pre-escaped. */
  note?: string;
}

const eyebrowStyle = `font-family:${MONO};font-size:10px;line-height:1;font-weight:700;letter-spacing:.16em;text-transform:uppercase`;

const logo = (src: string, size: number, cls = ''): string =>
  `<img src="${src}" alt="" width="${size}" height="${size}" class="${cls}" style="display:block;border:0;width:${size}px;height:${size}px">`;

function hero(appName: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:${HERO_BG};background-image:linear-gradient(135deg,#1b1d21 0%,${HERO_BG} 65%);border-radius:22px;padding:24px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:12px">${logo(LOGO_ON_DARK, 40)}</td>
<td style="${eyebrowStyle};color:${HERO_MUTED}">Self-hosted on your Pi</td></tr></table>
<div style="margin-top:44px;font-family:${FONT};font-size:34px;line-height:1;font-weight:800;letter-spacing:-.03em;color:${HERO_FG}">${appName}</div>
</td></tr></table>`;
}

function button({ label, href }: { label: string; href: string }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px"><tr><td class="btn" align="center" style="background:${L.btnBg};border-radius:999px"><a href="${href}" style="display:block;padding:17px 28px;font-family:${FONT};font-size:15px;font-weight:700;letter-spacing:-.01em;color:${L.btnFg};text-decoration:none">${label}</a></td></tr></table>
<p class="t-subtle" style="margin:14px 0 0;font-family:${MONO};font-size:11px;line-height:1.5;color:${L.subtle};word-break:break-all">${href}</p>`;
}

export function renderLayout(o: EmailLayoutOptions): string {
  const note = o.note
    ? `<div class="bg-surface t-muted" style="margin-top:24px;padding:16px 18px;background:${L.surface};border-radius:18px;font-size:13px;line-height:1.55;color:${L.muted}">${o.note}</div>`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${o.title}</title>
<style>@media (prefers-color-scheme:dark){${DARK_CSS}}</style></head>
<body class="bg-page" style="margin:0;padding:0;background:${L.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${o.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-page" style="background:${L.page}"><tr><td align="center" style="padding:24px 20px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;font-family:${FONT}"><tr><td>
${hero(o.appName)}
<h1 class="t-fg" style="margin:32px 0 10px;font-size:27px;line-height:1.15;font-weight:800;letter-spacing:-.03em;color:${L.fg}">${o.title}</h1>
<div class="t-muted" style="font-size:15px;line-height:1.55;color:${L.muted}">${o.body}</div>
${o.cta ? button(o.cta) : ''}${note}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:36px"><tr>
<td style="padding-right:10px">${logo(LOGO_ON_LIGHT, 22, 'logo-light')}${logo(LOGO_ON_DARK, 22, 'logo-dark').replace('display:block', 'display:none')}</td>
<td class="t-subtle" style="${eyebrowStyle};color:${L.subtle}">Sent by ${o.appName} · your vault, your Pi</td></tr></table>
</td></tr></table></td></tr></table></body></html>`;
}
