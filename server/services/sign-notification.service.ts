import type { SignRequestContext } from '~~/server/utils/email/types';

import env from '~~/lib/env';
import { emailService } from '~~/server/utils/email';
import { notifyCompletedTemplate } from '~~/server/utils/email/templates/notify-completed';
import { notifyRejectedTemplate } from '~~/server/utils/email/templates/notify-rejected';
import { notifySignedTemplate } from '~~/server/utils/email/templates/notify-signed';
import { notifySignerTemplate } from '~~/server/utils/email/templates/notify-signer';

export const signNotificationService = {

  async notifySigner(
    step: { signerEmail: string; signerName: string; stepOrder: number },
    context: SignRequestContext,
  ) {
    const signUrl = `${env.APP_URL}/signer/sign/${context.requestId}`;
    // Validate required email fields
    if (!step.signerEmail) {
      console.error('[notification] notifySigner: Missing signerEmail');
      return;
    }
    try {
      await emailService.send(notifySignerTemplate({
        to: step.signerEmail,
        signerName: step.signerName,
        currentStep: step.stepOrder - 1,
        signUrl,
        ...context,
      }));
    }
    catch (err) {
      console.error(`[notification] notifySigner failed:`, err);
    }
  },

  async notifySigned(
    step: { signerName: string; stepOrder: number },
    context: SignRequestContext,
  ) {
    if (!context.studentEmail) {
      console.error('[notification] notifySigned: Missing studentEmail');
      return;
    }
    try {
      await emailService.send(notifySignedTemplate({
        signerName: step.signerName,
        currentStep: step.stepOrder - 1,
        trackUrl: `${env.APP_URL}/student/my-request/${context.requestId}`,
        ...context,
      }));
    }
    catch (err) {
      console.error(`[notification] notifySigned failed:`, err);
    }
  },

  async notifyCompleted(signerName: string, context: SignRequestContext) {
    if (!context.studentEmail) {
      console.error('[notification] notifyCompleted: Missing studentEmail');
      return;
    }
    try {
      await emailService.send(notifyCompletedTemplate({
        signerName,
        trackUrl: `${env.APP_URL}/student/my-requests/${context.requestId}`,
        ...context,
      }));
    }
    catch (err) {
      console.error(`[notification] notifyCompleted failed:`, err);
    }
  },

  async notifyRejected(
    step: { signerName: string },
    context: SignRequestContext & { templateId: number | null },
    reason: string,
  ) {
    if (!context.studentEmail) {
      console.error('[notification] notifyRejected: Missing studentEmail');
      return;
    }
    try {
      await emailService.send(notifyRejectedTemplate({
        rejectedBy: `${step.signerName}`,
        reason,
        resubmitUrl: `${env.APP_URL}/student/new-request/${context.templateId ?? ''}`,
        ...context,
      }));
    }
    catch (err) {
      console.error(`[notification] notifyRejected failed:`, err);
    }
  },
};
