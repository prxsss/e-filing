// server/utils/email/adapters/resend.ts
import type { EmailAdapter, EmailPayload } from '../types';

export function createResendAdapter(apiKey: string, from: string): EmailAdapter {
  return {
    async send(payload: EmailPayload) {
      const { Resend } = await import('resend');
      const resend = new Resend(apiKey);
      await resend.emails.send({ from, ...payload });
    },
  };
}
