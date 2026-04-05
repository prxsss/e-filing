import db from '~~/lib/db';
import { userSignatures } from '~~/lib/db/schema';
import { eq } from 'drizzle-orm';

function normalizeSignatureDataUrl(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value)
    return '';

  const isDataUrl = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/.test(value);
  if (isDataUrl)
    return value;

  // Backward-compatible fallback: accept raw base64 and wrap as PNG data URL.
  const looksLikeBase64 = /^[a-z0-9+/=\s]+$/i.test(value) && value.length >= 64;
  if (looksLikeBase64)
    return `data:image/png;base64,${value.replace(/\s+/g, '')}`;

  return '';
}

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id;
  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  const body = await readBody(event);
  const signatureDataUrl = normalizeSignatureDataUrl(body?.signatureDataUrl);

  if (!signatureDataUrl) {
    return { success: false, error: 'Invalid signature data' };
  }

  if (signatureDataUrl.length > 1_048_576) {
    return { success: false, error: 'Signature image is too large (max 1 MB)' };
  }

  const nowIso = new Date().toISOString();
  const [existing] = await db
    .select({ id: userSignatures.id })
    .from(userSignatures)
    .where(eq(userSignatures.userId, userId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(userSignatures)
      .set({
        dataUrl: signatureDataUrl,
        updatedAt: nowIso,
      })
      .where(eq(userSignatures.id, existing.id))
      .returning({
        id: userSignatures.id,
        dataUrl: userSignatures.dataUrl,
        createdAt: userSignatures.createdAt,
        updatedAt: userSignatures.updatedAt,
      });

    return {
      success: true,
      data: updated,
    };
  }

  const [inserted] = await db
    .insert(userSignatures)
    .values({
      userId,
      dataUrl: signatureDataUrl,
      updatedAt: nowIso,
    })
    .returning({
      id: userSignatures.id,
      dataUrl: userSignatures.dataUrl,
      createdAt: userSignatures.createdAt,
      updatedAt: userSignatures.updatedAt,
    });

  return {
    success: true,
    data: inserted,
  };
});
