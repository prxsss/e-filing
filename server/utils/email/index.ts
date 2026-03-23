import env from '~~/lib/env';

import type { EmailAdapter, EmailPayload } from './types';

import { createConsoleAdapter } from './adapters/console';
import { createNodemailerAdapter } from './adapters/nodemailer';

function createEmailAdapter(): EmailAdapter {
  const provider = env.EMAIL_PROVIDER;

  switch (provider) {
    case 'nodemailer':
      return createNodemailerAdapter({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT),
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        from: env.SMTP_FROM,
      });
    case 'console':
    default:
      return createConsoleAdapter();
  }
}

const emailAdapter = createEmailAdapter();

export const emailService = {
  send: (payload: EmailPayload) => emailAdapter.send(payload),
};
