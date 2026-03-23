import type { EmailPayload } from '../types';

export function helloWorldEmailTemplate(): EmailPayload {
  return {
    subject: 'Hello, World!',
    html: '<strong>It works!</strong>',
    to: '',
  };
}
