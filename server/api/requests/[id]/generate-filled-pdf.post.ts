import db from '~~/lib/db';
import { request } from '~~/lib/db/schema';
import { supabaseAdmin } from '~~/lib/supabase/client';
import { buildFilledPdfBytesForRequest } from '~~/server/utils/build-filled-pdf-for-request';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');
    const userId = event.context.user!.id;

    if (!requestId) {
      return {
        success: false,
        error: 'Invalid request ID',
      };
    }

    const built = await buildFilledPdfBytesForRequest(requestId, userId);
    if (!built.success) {
      if (built.error === 'Forbidden') {
        throw createError({ statusCode: 403, message: 'Forbidden' });
      }
      return {
        success: false,
        error: built.error,
      };
    }

    const filename = `request-${requestId}-filled.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('filled-requests')
      .upload(filename, built.bytes, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return {
        success: false,
        error: `Failed to upload filled PDF: ${uploadError.message}`,
      };
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('filled-requests')
      .getPublicUrl(filename);

    await db
      .update(request)
      .set({ filledDocumentUrl: publicUrl })
      .where(eq(request.id, requestId));

    return {
      success: true,
      data: {
        filledDocumentUrl: publicUrl,
      },
    };
  }
  catch (error: any) {
    console.error('Error generating filled PDF:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate filled PDF',
    };
  }
});
