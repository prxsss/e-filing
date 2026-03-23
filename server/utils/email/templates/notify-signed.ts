import type { EmailPayload, SignRequestContext } from '../types';

export function notifySignedTemplate(options: {
  signerName: string;
  currentStep: number;
  trackUrl: string;
} & SignRequestContext): EmailPayload {
  return {
    to: options.studentEmail,
    subject: `[อัปเดตคำร้อง] ${options.documentTitle} — ขั้นตอนที่ ${options.currentStep}/${options.totalSteps} ผ่านแล้ว`,
    text: [
      `เรียน ${options.studentName}`,
      `${options.signerName} ได้ลงนามในเอกสาร "${options.documentTitle}" แล้ว`,
      `ความคืบหน้า: ${options.currentStep}/${options.totalSteps} ขั้นตอน`,
      `ติดตามสถานะ: ${options.trackUrl}`,
    ].join('\n\n'),
    html: `
<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0"
      style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;">
      <tr>
        <td style="padding:24px 32px;border-bottom:1px solid #e0e0e0;">
          <p style="margin:0 0 2px;font-size:12px;color:#888;">อัปเดตสถานะคำร้อง</p>
          <h1 style="margin:4px 0 0;font-size:18px;color:#111;">${options.documentTitle}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px;">
          <p style="margin:0 0 16px;color:#333;">เรียน <strong>${options.studentName}</strong></p>
          <p style="margin:0 0 16px;color:#333;">
            <strong>${options.signerName}</strong> ได้ลงนามเรียบร้อยแล้ว
          </p>
          <p style="margin:0 0 24px;font-size:13px;color:#666;">
            ความคืบหน้า ${options.currentStep} จาก ${options.totalSteps} ขั้นตอน
          </p>
          <a href="${options.trackUrl}"
            style="display:inline-block;padding:12px 28px;background:#111;color:#fff;
                  text-decoration:none;border-radius:4px;font-size:14px;">
            ติดตามสถานะ
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;border-top:1px solid #e0e0e0;background:#fafafa;">
          <p style="margin:0;font-size:12px;color:#aaa;">อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`,
  };
}
