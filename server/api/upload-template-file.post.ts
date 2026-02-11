import type { H3Event } from 'h3';

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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

    // Create upload directory if not exists
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'templates');
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const ext = file.filename.split('.').pop();
    const filename = `template_${timestamp}_${randomStr}.${ext}`;
    const filepath = join(uploadDir, filename);

    // Write file
    await writeFile(filepath, file.data);

    // Return public URL
    const publicUrl = `/uploads/templates/${filename}`;

    return {
      success: true,
      url: publicUrl,
      filename,
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
