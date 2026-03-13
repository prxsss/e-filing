import type { H3Event } from 'h3';

export async function requirePermission(event: H3Event, ...permissions: string[]) {
  return; // TEMP: disable permission checks for now during development

  const { user } = await getUserSession(event);

  const missingPermissions = permissions.filter(p => !user?.permissions.includes(p));
  if (missingPermissions.length > 0) {
    throw createError({
      statusCode: 403,
      message: `Forbidden: missing permission${missingPermissions.length > 1 ? 's' : ''} [${missingPermissions.join(', ')}]`,
    });
  }
}
