import db from '~~/lib/db';
import { userSignatures } from '~~/lib/db/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id;
  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  const [savedSignature] = await db
    .select({
      id: userSignatures.id,
      dataUrl: userSignatures.dataUrl,
      createdAt: userSignatures.createdAt,
      updatedAt: userSignatures.updatedAt,
    })
    .from(userSignatures)
    .where(eq(userSignatures.userId, userId))
    .limit(1);

  return {
    success: true,
    data: savedSignature ?? null,
  };
});
