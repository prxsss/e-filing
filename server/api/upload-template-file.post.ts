import type { H3Event } from 'h3';

import { supabaseAdmin } from '../../lib/supabase/client';

export default defineEventHandler(async (event: H3Event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
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
    const filename = `template_${timestamp}_${randomStr}.${ext}`;

    // Upload to Supabase Storage using admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin.storage
      .from('template-documents')
      .upload(filename, file.data, {
        contentType: file.type || 'application/pdf',
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
      .from('template-documents')
      .getPublicUrl(filename);

    return {
      success: true,
      url: publicUrl,
      filename,
      path: data.path,
    };
  }
  catch (error: any) {
    console.error('Error uploading file:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to upload file',
    });
  }
});
