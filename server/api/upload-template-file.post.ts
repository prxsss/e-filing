import type { H3Event } from 'h3';

<<<<<<< HEAD
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
=======
import { supabaseAdmin } from '../../lib/supabase/client';
>>>>>>> admin-template-supabase

export default defineEventHandler(async (event: H3Event) => {
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

<<<<<<< HEAD
    // Create upload directory if not exists
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'templates');
    await mkdir(uploadDir, { recursive: true });

=======
>>>>>>> admin-template-supabase
    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const ext = file.filename.split('.').pop();
    const filename = `template_${timestamp}_${randomStr}.${ext}`;
<<<<<<< HEAD
    const filepath = join(uploadDir, filename);

    // Write file
    await writeFile(filepath, file.data);

    // Return public URL
    const publicUrl = `/uploads/templates/${filename}`;
=======

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
>>>>>>> admin-template-supabase

    return {
      success: true,
      url: publicUrl,
      filename,
<<<<<<< HEAD
=======
      path: data.path,
>>>>>>> admin-template-supabase
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
