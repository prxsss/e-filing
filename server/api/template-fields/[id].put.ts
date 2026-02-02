import { eq } from 'drizzle-orm';

import db from '../../../lib/db/index';
import { requestTemplateFields } from '../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id');
    if (!id) {
      return {
        success: false,
        error: 'ไม่พบ ID ของ Field',
      };
    }

    const body = await readBody(event);

    // Validate required fields
    if (!body.name || !body.type || !body.label || !body.icon) {
      return {
        success: false,
        error: 'กรุณากรอกข้อมูลให้ครบถ้วน',
      };
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
      return {
        success: false,
        error: 'ไม่พบ Field ที่ต้องการอัพเดท',
      };
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
  catch (error) {
    console.error('Error updating template field:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอัพเดท Field',
    };
  }
});
