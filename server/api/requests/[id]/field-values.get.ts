import { eq } from 'drizzle-orm';

import db from '../../../../lib/db';
import { requestTemplateValues } from '../../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!requestId) {
      return {
        success: false,
        error: 'Invalid request ID',
      };
    }

    // Get all field values for this request
    const fieldValues = await db
      .select()
      .from(requestTemplateValues)
      .where(eq(requestTemplateValues.requestId, requestId));

    return {
      success: true,
      data: fieldValues,
    };
  }
  catch (error: any) {
    console.error('Error fetching field values:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch field values',
    };
  }
});
