import type { H3Event } from 'h3';

export function hasPermission(event: H3Event, ...permissions: string[]) {
  const userPermissions = event.context.user?.permissions ?? [];
  return permissions.every(permission => userPermissions.includes(permission));
}

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
