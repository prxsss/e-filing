import type { H3Event } from 'h3';

import { eq } from 'drizzle-orm';

import db from '../../../../../lib/db';
import { attachments, request } from '../../../../../lib/db/schema';
import { supabaseAdmin } from '../../../../../lib/supabase/client';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const requestId = event.context.params?.id;

    if (!requestId) {
      throw createError({
        statusCode: 400,
        message: 'Request ID is required',
      });
    }

    // Verify request exists
    const requestRecord = await db
      .select()
      .from(request)
      .where(eq(request.id, Number(requestId)))
      .limit(1);

    if (!requestRecord || requestRecord.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Request not found',
      });
    }

    const formData = await readMultipartFormData(event);

    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No file uploaded',
      });
    }

    const file = formData[0];

    if (!file.filename || !file.data) {
      throw createError({
        statusCode: 400,
        message: 'Invalid file data',
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const ext = file.filename.split('.').pop();
    const filename = `request_${requestId}_${timestamp}_${randomStr}.${ext}`;

    // Upload to Supabase Storage
    const { error } = await supabaseAdmin.storage
      .from('request-attachments')
      .upload(filename, file.data, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw createError({
        statusCode: 500,
        message: `Failed to upload to Supabase: ${error.message}`,
      });
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('request-attachments')
      .getPublicUrl(filename);

    // Save attachment record to database
    const [attachment] = await db
      .insert(attachments)
      .values({
        requestId: Number(requestId),
        fileName: file.filename,
        fileUrl: publicUrl,
      })
      .returning();

    return {
      success: true,
      data: attachment,
    };
  }
  catch (error: any) {
    console.error('Error uploading attachment:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to upload attachment',
    });
  }
});
