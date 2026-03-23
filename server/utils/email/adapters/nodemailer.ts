import type { EmailAdapter, EmailPayload } from '../types';

export function createNodemailerAdapter(options: {
  host: string;
  port: number;
  auth: { user: string; pass: string };
  from: string;
}): EmailAdapter {
  return {
    async send(payload: EmailPayload) {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: options.host,
        port: options.port,
        auth: options.auth,
      });
      await transporter.sendMail({
        from: options.from,
        ...payload,
      });
    },
  };
};
