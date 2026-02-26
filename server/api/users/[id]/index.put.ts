import db from '~~/lib/db';
import { users } from '~~/lib/db/schema';
import { eq } from 'drizzle-orm';

export type UpdateUserBody = {
  fullName?: string;
  email?: string;
  institutionId?: string;
  facultyId?: number | null;
  status?: 'active' | 'suspended' | 'pending' | 'deleted';
};

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const body = await readBody<UpdateUserBody>(event);

  try {
    // Update user basic information
    const updateData: Record<string, any> = {};

    if (body.fullName !== undefined) {
      updateData.name = body.fullName;
    }
    if (body.facultyId !== undefined) {
      updateData.facultyId = body.facultyId;
    }
    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(users)
        .set(updateData)
        .where(eq(users.id, id ?? ''));
    }

    return { success: true };
  }
  catch (error) {
    console.error('Error updating user:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update user',
    });
  }
});
