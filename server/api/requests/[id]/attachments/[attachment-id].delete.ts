import type { H3Event } from 'h3';

import { eq } from 'drizzle-orm';

import db from '../../../../../lib/db';
import { attachments } from '../../../../../lib/db/schema';
import { supabaseAdmin } from '../../../../../lib/supabase/client';

export default defineEventHandler(async (event: H3Event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const attachmentId = getRouterParam(event, 'attachment-id');

    if (!attachmentId) {
      throw createError({
        statusCode: 400,
        message: 'Attachment ID is required',
      });
    }

    // Get attachment details
    const [attachment] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, Number(attachmentId)))
      .limit(1);

    if (!attachment) {
      throw createError({
        statusCode: 404,
        message: 'Attachment not found',
      });
    }

    // Extract filename from URL
    const urlParts = attachment.fileUrl?.split('/');
    const filename = urlParts?.[urlParts.length - 1];

    if (filename) {
      // Delete from Supabase Storage
      const { error } = await supabaseAdmin.storage
        .from('request-attachments')
        .remove([filename]);

      if (error) {
        console.error('Supabase delete error:', error);
        // Continue even if storage delete fails
      }
    }

    // Delete from database
    await db
      .delete(attachments)
      .where(eq(attachments.id, Number(attachmentId)));

    return {
      success: true,
      message: 'Attachment deleted successfully',
    };
  }
  catch (error: any) {
    console.error('Error deleting attachment:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to delete attachment',
    });
  }
});
