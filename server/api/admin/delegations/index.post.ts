import { createDelegation } from '~~/lib/db/queries/dean-delegation';
import * as zod from 'zod';

const nullableDateTimeString = zod.string().trim().nullable().optional().refine(
  value => value == null || value === '' || !Number.isNaN(new Date(value).getTime()),
  { message: 'Invalid date-time format' },
);

const schema = zod.object({
  facultyId: zod.number().int().positive('Faculty is required'),
  delegateUserId: zod.string().trim().min(1, 'Delegate user is required'),
  allowedTemplateIds: zod.array(zod.number().int().positive()).default([]),
  startDate: nullableDateTimeString,
  endDate: nullableDateTimeString,
  active: zod.boolean().default(true),
  note: zod.string().trim().max(500).nullable().optional(),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'faculty.edit');

  const body = await readValidatedBody(event, schema.parse);
  const startDate = body.startDate ? new Date(body.startDate).toISOString() : null;
  const endDate = body.endDate ? new Date(body.endDate).toISOString() : null;

  if (startDate && endDate && new Date(startDate).getTime() >= new Date(endDate).getTime()) {
    throw createError({ statusCode: 400, message: 'Start date must be before end date' });
  }

  const delegation = await createDelegation({
    ...body,
    startDate,
    endDate,
  });
  return { success: true, delegation };
});
