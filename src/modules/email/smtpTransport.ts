import { createTransport, type Transporter } from 'nodemailer';
import type { SmtpConfig } from '../../core/config/AppConfig.js';

const TIMEOUT_MS = 15_000;

/**
 * Pooled SMTP transport. Never plaintext: port 465 uses implicit TLS, otherwise
 * STARTTLS is mandatory (the send fails rather than downgrading).
 */
export function createSmtpTransport(config: SmtpConfig): Transporter {
  return createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.user, pass: config.password },
    pool: true,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
}
