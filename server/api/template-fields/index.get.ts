import type { H3Event } from 'h3';

import db from '../../../lib/db/index';
import { requestTemplateFields } from '../../../lib/db/schema';

export default defineEventHandler(async (_event: H3Event) => {
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
  catch (error: any) {
    console.error('Error fetching template fields:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch template fields',
    });
  }
});
