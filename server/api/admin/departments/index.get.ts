import { getDepartments } from '~~/lib/db/queries/department';

export default defineEventHandler(async () => {
  return await getDepartments();
});
