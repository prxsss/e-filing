import db from '../../../lib/db/index';
import { requestTemplateFields } from '../../../lib/db/schema';

export default defineEventHandler(async () => {
  try {
    const fields = await db.select().from(requestTemplateFields);

    // Map ข้อมูลให้ตรงกับ format ที่ frontend ต้องการ
    const mappedFields = fields.map(field => ({
      id: field.id,
      name: field.name,
      label: field.label,
      type: field.type,
      icon: field.icon,
      default_width: field.width,
      default_height: field.height,
      amount: field.amount || 1,
      font: field.font,
      fontSize: field.fontSize,
      isFillable: field.isFillable,
    }));

    return {
      success: true,
      data: mappedFields,
    };
  }
  catch (error) {
    console.error('Error fetching template fields:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [],
    };
  }
});
