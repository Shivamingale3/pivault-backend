/** Templates the app can send. Rendering lives with the sender implementation. */
export const EmailTemplate = {
  Welcome: 'welcome',
  PasswordReset: 'password-reset',
} as const;

export type EmailTemplate = (typeof EmailTemplate)[keyof typeof EmailTemplate];

export interface EmailMessage {
  to: string;
  template: EmailTemplate;
  /** Template variables, e.g. `{ firstName, resetUrl }`. */
  variables: Record<string, string>;
}

/** Delivery abstraction: SMTP in production, a logger in development and tests. */
export interface IEmailSender {
  send(message: EmailMessage): Promise<void>;
}
