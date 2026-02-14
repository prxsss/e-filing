import { and, eq } from 'drizzle-orm';

import db from '../../../../lib/db';
import { requestTemplateValues } from '../../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');
    const body = await readBody(event);

    if (!requestId || !body.fieldValues) {
      return {
        success: false,
        error: 'Invalid request data',
      };
    }

    // Validate that fieldValues is an array
    if (!Array.isArray(body.fieldValues)) {
      return {
        success: false,
        error: 'fieldValues must be an array',
      };
    }

    // Process each field value
    const results = [];
    for (const fieldValue of body.fieldValues) {
      const { fieldId, value } = fieldValue;

      if (!fieldId) {
        continue;
      }

      // Check if this field value already exists
      const existing = await db
        .select()
        .from(requestTemplateValues)
        .where(
          and(
            eq(requestTemplateValues.requestId, requestId),
            eq(requestTemplateValues.fieldId, fieldId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing value
        await db
          .update(requestTemplateValues)
          .set({ value, createdAt: new Date() })
          .where(eq(requestTemplateValues.id, existing[0].id));

        results.push({ fieldId, action: 'updated' });
      }
      else {
        // Insert new value
        await db.insert(requestTemplateValues).values({
          requestId,
          fieldId,
          value,
        });

        results.push({ fieldId, action: 'created' });
      }
    }

    return {
      success: true,
      data: results,
    };
  }
  catch (error: any) {
    console.error('Error saving field values:', error);
    return {
      success: false,
      error: error.message || 'Failed to save field values',
    };
  }
});
