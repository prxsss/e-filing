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

    // Delete field
    const [deletedField] = await db
      .delete(requestTemplateFields)
      .where(eq(requestTemplateFields.id, Number(id)))
      .returning();

    if (!deletedField) {
      throw createError({
        statusCode: 404,
        message: 'ไม่พบ Field ที่ต้องการลบ',
      });
    }

    return {
      success: true,
      message: 'ลบ Field สำเร็จ',
    };
  }
  catch (error: any) {
    console.error('Error deleting template field:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'เกิดข้อผิดพลาดในการลบ Field',
    });
  }
});
