import { getFaculties } from '~~/lib/db/queries/faculty';

export default defineEventHandler(async () => {
  return await getFaculties();
});
