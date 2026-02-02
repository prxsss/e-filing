import db from '../../../lib/db/index';
import { requestTemplateFields } from '../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // Validate required fields
    if (!body.name || !body.type || !body.label || !body.icon) {
      return {
        success: false,
        error: 'กรุณากรอกข้อมูลให้ครบถ้วน',
      };
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
  catch (error) {
    console.error('Error creating template field:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสร้าง Field',
    };
  }
});
