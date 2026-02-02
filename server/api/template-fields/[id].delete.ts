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

    // Delete field
    const [deletedField] = await db
      .delete(requestTemplateFields)
      .where(eq(requestTemplateFields.id, Number(id)))
      .returning();

    if (!deletedField) {
      return {
        success: false,
        error: 'ไม่พบ Field ที่ต้องการลบ',
      };
    }

    return {
      success: true,
      message: 'ลบ Field สำเร็จ',
    };
  }
  catch (error) {
    console.error('Error deleting template field:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบ Field',
    };
  }
});
