import { getDelegationById, updateDelegation } from '~~/lib/db/queries/dean-delegation';
import * as zod from 'zod';

const nullableDateTimeString = zod.string().trim().nullable().optional().refine(
  value => value == null || value === '' || !Number.isNaN(new Date(value).getTime()),
  { message: 'Invalid date-time format' },
);

const schema = zod.object({
  facultyId: zod.number().int().positive().optional(),
  delegateUserId: zod.string().trim().min(1).optional(),
  allowedTemplateIds: zod.array(zod.number().int().positive()).optional(),
  startDate: nullableDateTimeString,
  endDate: nullableDateTimeString,
  active: zod.boolean().optional(),
  note: zod.string().trim().max(500).nullable().optional(),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'faculty.edit');

  const id = Number(getRouterParam(event, 'id'));
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid delegation id' });
  }

  const existing = await getDelegationById(id);
  if (!existing) {
    throw createError({ statusCode: 404, message: `Delegation with ID ${id} not found` });
  }

  const body = await readValidatedBody(event, schema.parse);

  const normalizedStartDate = body.startDate !== undefined
    ? (body.startDate ? new Date(body.startDate).toISOString() : null)
    : undefined;
  const normalizedEndDate = body.endDate !== undefined
    ? (body.endDate ? new Date(body.endDate).toISOString() : null)
    : undefined;

  const startDate = normalizedStartDate !== undefined ? normalizedStartDate : existing.startDate;
  const endDate = normalizedEndDate !== undefined ? normalizedEndDate : existing.endDate;
  if (startDate && endDate && new Date(startDate).getTime() >= new Date(endDate).getTime()) {
    throw createError({ statusCode: 400, message: 'Start date must be before end date' });
  }

  const updated = await updateDelegation(id, {
    ...body,
    ...(normalizedStartDate !== undefined ? { startDate: normalizedStartDate } : {}),
    ...(normalizedEndDate !== undefined ? { endDate: normalizedEndDate } : {}),
  });
  if (!updated) {
    throw createError({ statusCode: 500, message: 'Failed to update delegation' });
  }

  return { success: true, delegation: updated };
});
