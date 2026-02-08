import type { H3Event } from 'h3';

import { eq } from 'drizzle-orm';

import db from '../../../lib/db/index';
import { requestTemplateFields } from '../../../lib/db/schema';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const id = getRouterParam(event, 'id');
    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ไม่พบ ID ของ Field',
      });
    }

    const body = await readBody(event);

    // Validate required fields
    if (!body.name || !body.type || !body.label || !body.icon) {
      throw createError({
        statusCode: 400,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน',
      });
    }

    // Update field
    const [updatedField] = await db
      .update(requestTemplateFields)
      .set({
        name: body.name,
        type: body.type,
        label: body.label,
        icon: body.icon,
        width: body.width || 150,
        height: body.height || 40,
        amount: body.amount || 1,
        font: body.font || null,
        fontSize: body.fontSize || null,
        isFillable: body.isFillable ?? true,
      })
      .where(eq(requestTemplateFields.id, Number(id)))
      .returning();

    if (!updatedField) {
      throw createError({
        statusCode: 404,
        message: 'ไม่พบ Field ที่ต้องการอัพเดท',
      });
    }

    // Map ข้อมูลให้ตรงกับ format ที่ frontend ต้องการ
    const mappedField = {
      id: updatedField.id,
      name: updatedField.name,
      label: updatedField.label,
      type: updatedField.type,
      icon: updatedField.icon,
      default_width: updatedField.width,
      default_height: updatedField.height,
      amount: updatedField.amount || 1,
      font: updatedField.font,
      fontSize: updatedField.fontSize,
      isFillable: updatedField.isFillable,
    };

    return {
      success: true,
      data: mappedField,
      message: 'อัพเดท Field สำเร็จ',
    };
  }
  catch (error: any) {
    console.error('Error updating template field:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'เกิดข้อผิดพลาดในการอัพเดท Field',
    });
  }
});
