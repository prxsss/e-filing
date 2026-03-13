import db from '~~/lib/db';
import { faculties } from '~~/lib/db/schema';

export default defineEventHandler(async () => {
  return await db.select({
    id: faculties.id,
    facultyCode: faculties.facultyCode,
    nameEn: faculties.nameEn,
    nameTh: faculties.nameTh,
  }).from(faculties).orderBy(faculties.id);
});
