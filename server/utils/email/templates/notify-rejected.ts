import type { EmailPayload, SignRequestContext } from '../types';

export function notifyRejectedTemplate(options: {
  rejectedBy: string;
  reason: string;
  resubmitUrl: string;
} & SignRequestContext): EmailPayload {
  return {
    to: options.studentEmail,
    subject: `[คำร้องถูกปฏิเสธ] ${options.documentTitle}`,
    text: [
      `เรียน ${options.studentName}`,
      `เอกสาร "${options.documentTitle}" ถูกปฏิเสธโดย ${options.rejectedBy}`,
      `เหตุผล: ${options.reason}`,
      `ยื่นคำร้องใหม่ได้ที่: ${options.resubmitUrl}`,
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
          <p style="margin:0 0 2px;font-size:12px;color:#888;">คำร้องถูกปฏิเสธ</p>
          <h1 style="margin:4px 0 0;font-size:18px;color:#111;">${options.documentTitle}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px;">
          <p style="margin:0 0 16px;color:#333;">เรียน <strong>${options.studentName}</strong></p>
          <p style="margin:0 0 16px;color:#333;">
            คำร้องของคุณถูกปฏิเสธโดย <strong>${options.rejectedBy}</strong>
          </p>
          <p style="margin:0 0 6px;font-size:12px;color:#888;">เหตุผล</p>
          <p style="margin:0 0 24px;padding:12px;background:#f9f9f9;
                    border-left:3px solid #ccc;color:#555;border-radius:0 4px 4px 0;">
            ${options.reason}
          </p>
          <a href="${options.resubmitUrl}"
            style="display:inline-block;padding:12px 28px;background:#111;color:#fff;
                  text-decoration:none;border-radius:4px;font-size:14px;">
            ยื่นคำร้องใหม่
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
