// server/utils/email/templates/notify-signer.ts
import type { EmailPayload, SignRequestContext } from '../types';

export function notifySignerTemplate(options: {
  to: string;
  signerName: string;
  currentStep: number;
  signUrl: string;
} & SignRequestContext): EmailPayload {
  return {
    to: options.to,
    subject: `[ขอลายเซ็น] ${options.documentTitle} — ${options.studentName} (${options.studentId})`,
    text: [
      `เรียน ${options.signerName}`,
      `${options.studentName} (${options.studentId}) ขอลายเซ็นในเอกสาร "${options.documentTitle}"`,
      `คณะ/สาขา: ${options.faculty}`,
      `ขั้นตอนที่ ${options.currentStep} จาก ${options.totalSteps}`,
      `ลงนามได้ที่: ${options.signUrl}`,
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
          <p style="margin:0 0 2px;font-size:12px;color:#888;">ขอลายเซ็นเอกสาร — ขั้นตอนที่ ${options.currentStep}/${options.totalSteps}</p>
          <h1 style="margin:4px 0 0;font-size:18px;color:#111;">${options.documentTitle}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 0;">
          <p style="margin:0 0 16px;color:#333;">เรียน <strong>${options.signerName}</strong></p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0"
            style="border:1px solid #e8e8e8;border-radius:4px;overflow:hidden;">
            <tr style="background:#fafafa;">
              <td style="padding:10px 16px;font-size:12px;color:#888;width:40%;border-bottom:1px solid #e8e8e8;">ชื่อ-สกุล</td>
              <td style="padding:10px 16px;font-size:14px;color:#111;border-bottom:1px solid #e8e8e8;">${options.studentName}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-size:12px;color:#888;border-bottom:1px solid #e8e8e8;">รหัสนักศึกษา</td>
              <td style="padding:10px 16px;font-size:14px;color:#111;border-bottom:1px solid #e8e8e8;">${options.studentId}</td>
            </tr>
            <tr style="background:#fafafa;">
              <td style="padding:10px 16px;font-size:12px;color:#888;border-bottom:1px solid #e8e8e8;">คณะ</td>

              <td style="padding:10px 16px;font-size:14px;color:#111;border-bottom:1px solid #e8e8e8;">${options.faculty}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-size:12px;color:#888;">สาขาวิชา</td>
              <td style="padding:10px 16px;font-size:14px;color:#111;">${options.department}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px;">
          <a href="${options.signUrl}"
            style="display:inline-block;padding:12px 28px;background:oklch(69.6% .17 162.48);color:#fff;
                  text-decoration:none;border-radius:4px;font-size:14px;">
            ตรวจสอบและลงนาม
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
