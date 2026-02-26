import db from '..';
import { roles } from '../schema';

export async function getRoles() {
  return db.select().from(roles);
}
