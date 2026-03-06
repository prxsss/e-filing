import { createRole } from '~~/lib/db/queries/role';

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    name: string;
    descriptionEN?: string | null;
    descriptionTH?: string | null;
    permissionIds?: number[];
  }>(event);

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Role name is required' });
  }

  if (body.permissionIds && !Array.isArray(body.permissionIds)) {
    throw createError({ statusCode: 400, statusMessage: 'permissionIds must be an array' });
  }

  try {
    const role = await createRole({
      name: body.name.trim(),
      descriptionEN: body.descriptionEN,
      descriptionTH: body.descriptionTH,
      permissionIds: body.permissionIds,
    });

    return { success: true, role };
  }
  catch (error: any) {
    if (error?.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'A role with this name already exists' });
    }
    throw error;
  }
});
