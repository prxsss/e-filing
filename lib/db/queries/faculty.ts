import db from '..';
import { faculties } from '../schema';

export async function getFaculties() {
  return db.select().from(faculties);
}
