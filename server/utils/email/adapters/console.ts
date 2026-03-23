/* eslint-disable no-console */
import type { EmailAdapter, EmailPayload } from '../types';

export function createConsoleAdapter(): EmailAdapter {
  return {
    async send(payload: EmailPayload) {
      console.log('\n📧 [Email Console Adapter]');
      console.log('To:', payload.to);
      console.log('Subject:', payload.subject);
      console.log('Body:', payload.text || payload.html);
      console.log('─'.repeat(40));
    },
  };
}
