import {
  ONBOARDING_LINK_HOURS,
  RESET_LINK_MINUTES,
} from '../passwordReset/passwordReset.constants.js';
import { renderLayout } from './emailLayout.js';
import { EmailTemplate, type EmailMessage } from './IEmailSender.js';

export const APP_NAME = 'PiVault';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Template variables are user-controlled (e.g. first name), so they are always escaped. */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

function variable(message: EmailMessage, key: string): string {
  const value = message.variables[key];
  if (value === undefined) throw new Error(`Email "${message.template}" is missing "${key}"`);
  return value;
}

/** Only http(s) links may be rendered into a reset email. */
function safeUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Email link must be http(s)');
  }
  return url.toString();
}

function welcome(message: EmailMessage): RenderedEmail {
  const name = variable(message, 'firstName');
  const link = safeUrl(variable(message, 'resetUrl'));
  const intro = `Hi ${name}, your ${APP_NAME} account is ready. Set your own password to get started. The link works for ${ONBOARDING_LINK_HOURS} hours.`;
  const note = `After that you will set an app lock and save your recovery key. ${APP_NAME} never sees the key or what is inside your vault.`;
  return {
    subject: `Welcome to ${APP_NAME}: set your password`,
    text: `${intro}\n\nSet your password:\n${link}\n\n${note}\n`,
    html: renderLayout({
      appName: APP_NAME,
      preheader: escapeHtml(intro),
      title: 'Set your password',
      body: `<p style="margin:0">${escapeHtml(intro)}</p>`,
      cta: { label: 'Set password', href: escapeHtml(link) },
      note: escapeHtml(note),
    }),
  };
}

function passwordReset(message: EmailMessage): RenderedEmail {
  const name = variable(message, 'firstName');
  const link = safeUrl(variable(message, 'resetUrl'));
  const intro = `Hi ${name}, we got a request to reset your ${APP_NAME} password. The link works for ${RESET_LINK_MINUTES} minutes.`;
  const note =
    'Did not ask for this? Ignore this email and your password stays the same. Resetting it never changes your vault encryption.';
  return {
    subject: `Reset your ${APP_NAME} password`,
    text: `${intro}\n\nReset your password:\n${link}\n\n${note}\n`,
    html: renderLayout({
      appName: APP_NAME,
      preheader: escapeHtml(intro),
      title: 'Reset your password',
      body: `<p style="margin:0">${escapeHtml(intro)}</p>`,
      cta: { label: 'Reset password', href: escapeHtml(link) },
      note: escapeHtml(note),
    }),
  };
}

const RENDERERS: Record<EmailTemplate, (message: EmailMessage) => RenderedEmail> = {
  [EmailTemplate.Welcome]: welcome,
  [EmailTemplate.PasswordReset]: passwordReset,
};

export const renderEmail = (message: EmailMessage): RenderedEmail =>
  RENDERERS[message.template](message);
