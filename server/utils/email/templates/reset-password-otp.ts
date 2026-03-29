import type { EmailPayload } from '../types';

export function resetPasswordOtpTemplate(options: {
  to: string;
  name: string;
  otp: string;
}): EmailPayload {
  return {
    to: options.to,
    subject: 'รหัสยืนยันการรีเซ็ตรหัสผ่าน',
    text: [
      `เรียน ${options.name}`,
      `รหัสยืนยันสำหรับรีเซ็ตรหัสผ่านของคุณคือ ${options.otp}`,
      'รหัสนี้จะหมดอายุใน 10 นาที',
      'หากคุณไม่ได้ทำรายการนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้',
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
          <p style="margin:0 0 2px;font-size:12px;color:#888;">รีเซ็ตรหัสผ่าน</p>
          <h1 style="margin:4px 0 0;font-size:18px;color:#111;">รหัสยืนยันของคุณ</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px;">
          <p style="margin:0 0 16px;color:#333;">เรียน <strong>${options.name}</strong></p>
          <p style="margin:0 0 24px;color:#333;">กรุณาใช้รหัสด้านล่างเพื่อยืนยันการรีเซ็ตรหัสผ่าน</p>
          <div style="text-align:center;margin:0 0 24px;">
            <span style="display:inline-block;padding:16px 40px;background:#f5f5f5;
                        border-radius:6px;font-size:32px;font-weight:bold;
                        letter-spacing:8px;color:#111;">
              ${options.otp}
            </span>
          </div>
          <p style="margin:0;font-size:13px;color:#888;text-align:center;">
            รหัสนี้จะหมดอายุใน 10 นาที
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;border-top:1px solid #e0e0e0;background:#fafafa;">
          <p style="margin:0;font-size:12px;color:#aaa;">
            หากคุณไม่ได้ทำรายการนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`,
  };
}
