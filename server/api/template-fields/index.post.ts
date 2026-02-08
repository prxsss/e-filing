import type { H3Event } from 'h3';

import db from '../../../lib/db/index';
import { requestTemplateFields } from '../../../lib/db/schema';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const body = await readBody(event);

    // Validate required fields
    if (!body.name || !body.type || !body.label || !body.icon) {
      throw createError({
        statusCode: 400,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน',
      });
    }

    // Insert new field
    const [newField] = await db.insert(requestTemplateFields).values({
      name: body.name,
      type: body.type,
      label: body.label,
      icon: body.icon,
      width: body.width || 100,
      height: body.height || 40,
      amount: body.amount || 1,
      font: body.font || 'Sarabun',
      fontSize: body.fontSize || 14,
      isFillable: body.isFillable ?? true,
    }).returning();

    // Map ข้อมูลให้ตรงกับ format ที่ frontend ต้องการ
    const mappedField = {
      id: newField.id,
      name: newField.name,
      label: newField.label,
      type: newField.type,
      icon: newField.icon,
      default_width: newField.width,
      default_height: newField.height,
      amount: newField.amount || 1,
      font: newField.font,
      fontSize: newField.fontSize,
      isFillable: newField.isFillable,
    };

    return {
      success: true,
      data: mappedField,
      message: 'สร้าง Field สำเร็จ',
    };
  }
  catch (error: any) {
    console.error('Error creating template field:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'เกิดข้อผิดพลาดในการสร้าง Field',
    });
  }
});
