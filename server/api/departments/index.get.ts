import db from '~~/lib/db';
import { departments } from '~~/lib/db/schema';

export default defineEventHandler(async () => {
  return await db.select().from(departments);
});
