import { eq } from 'drizzle-orm';

import db from '../../../lib/db';
import { request, requestTemplateValues } from '../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!requestId) {
      return {
        success: false,
        error: 'Invalid request ID',
      };
    }

    // Get request details
    const requestData = await db
      .select()
      .from(request)
      .where(eq(request.id, requestId))
      .limit(1);

    if (requestData.length === 0) {
      return {
        success: false,
        error: 'Request not found',
      };
    }

    // Get field values for this request
    const fieldValues = await db
      .select()
      .from(requestTemplateValues)
      .where(eq(requestTemplateValues.requestId, requestId));

    return {
      success: true,
      data: {
        request: requestData[0],
        fieldValues,
      },
    };
  }
  catch (error: any) {
    console.error('Error fetching request:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch request',
    };
  }
});
