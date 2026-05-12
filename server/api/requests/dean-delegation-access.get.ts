import { getActiveDelegationsForUser } from '~~/lib/db/queries/dean-delegation';

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id;
  if (!userId) {
    return { success: true, canAccess: false };
  }

  const delegations = await getActiveDelegationsForUser(userId);
  return {
    success: true,
    canAccess: delegations.length > 0,
  };
});
