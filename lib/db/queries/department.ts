import db from '..';
import { departments } from '../schema';

export async function getDepartments() {
  return await db.select().from(departments);
}
