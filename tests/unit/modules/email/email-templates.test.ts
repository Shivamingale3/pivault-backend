import { describe, it, expect } from 'vitest';
import { escapeHtml, renderEmail } from '../../../../src/modules/email/emailTemplates.js';
import { EmailTemplate } from '../../../../src/modules/email/IEmailSender.js';

const SET_URL = 'https://vault.example.com/reset-password?key=abc';
const welcome = (firstName: string) => ({
  to: 'jane@example.com',
  template: EmailTemplate.Welcome,
  variables: { firstName, resetUrl: SET_URL },
});

describe('renderEmail', () => {
  it('renders the welcome email in text and html', () => {
    const mail = renderEmail(welcome('Jane'));
    expect(mail.subject).toBe('Welcome to PiVault: set your password');
    expect(mail.text).toContain('Hi Jane');
    expect(mail.html).toContain('Hi Jane');
    expect(mail.html).toContain('Set your password');
    expect(mail.html).toContain(`href="${SET_URL}"`);
    expect(mail.text).toContain(SET_URL);
    expect(mail.text).toContain('24 hours');
  });

  it('escapes user-controlled values in html but not in plain text', () => {
    const mail = renderEmail(welcome('<img src=x onerror=alert(1)>'));
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).toContain('&lt;img');
    expect(mail.text).toContain('<img');
  });

  it('renders a password reset with the link', () => {
    const mail = renderEmail({
      to: 'jane@example.com',
      template: EmailTemplate.PasswordReset,
      variables: {
        firstName: 'Jane',
        resetUrl: 'https://vault.example.com/reset-password?key=abc',
      },
    });
    expect(mail.text).toContain('https://vault.example.com/reset-password?key=abc');
    expect(mail.html).toContain('href="https://vault.example.com/reset-password?key=abc"');
  });

  it('brands the email with both hosted logos (dark card, light/dark footer swap)', () => {
    const { html } = renderEmail(welcome('Jane'));
    expect(html).toContain('/assets/logo/dark.png');
    expect(html).toContain('/assets/logo/light.png');
    expect(html).toContain('Self-hosted on your Pi');
    expect(html).toContain('.logo-light{display:none!important}');
  });

  it('follows the design system: tokens, dark mode support and a pill button', () => {
    const mail = renderEmail({
      to: 'jane@example.com',
      template: EmailTemplate.PasswordReset,
      variables: {
        firstName: 'Jane',
        resetUrl: 'https://vault.example.com/reset-password?key=abc',
      },
    });
    expect(mail.html).toContain('prefers-color-scheme:dark');
    expect(mail.html).toContain('#101010');
    expect(mail.html).toContain('border-radius:999px');
    expect(mail.html).toContain('border-radius:22px');
    expect(mail.html).toContain('Reset password');
  });

  it('refuses non-http(s) reset links and missing variables', () => {
    const reset = (variables: Record<string, string>) =>
      renderEmail({ to: 'a@b.co', template: EmailTemplate.PasswordReset, variables });
    expect(() => reset({ firstName: 'J', resetUrl: 'javascript:alert(1)' })).toThrow();
    expect(() => reset({ firstName: 'J' })).toThrow(/missing "resetUrl"/);
  });

  it('escapeHtml covers the five special characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});
