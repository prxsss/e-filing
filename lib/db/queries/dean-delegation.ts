import { and, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';

import db from '..';
import { deanSigningDelegations, faculties, userRoles, users } from '../schema';

export type DelegationListItem = {
  id: number;
  facultyId: number;
  facultyNameEn: string;
  facultyNameTh: string;
  delegateUserId: string;
  delegateNameEn: string;
  delegateNameTh: string;
  delegateEmail: string;
  allowedTemplateIds: number[];
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateDelegationInput = {
  facultyId: number;
  delegateUserId: string;
  allowedTemplateIds: number[];
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean;
  note?: string | null;
};

export type UpdateDelegationInput = Partial<CreateDelegationInput>;

export async function getDelegations({ facultyId }: { facultyId?: number } = {}): Promise<DelegationListItem[]> {
  const rows = await db
    .select({
      id: deanSigningDelegations.id,
      facultyId: deanSigningDelegations.facultyId,
      facultyNameEn: faculties.nameEn,
      facultyNameTh: faculties.nameTh,
      delegateUserId: deanSigningDelegations.delegateUserId,
      delegateNameEn: sql<string>`concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ' ', ${users.lastNameEn})`,
      delegateNameTh: sql<string>`concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`,
      delegateEmail: users.email,
      allowedTemplateIds: deanSigningDelegations.allowedTemplateIds,
      startDate: deanSigningDelegations.startDate,
      endDate: deanSigningDelegations.endDate,
      active: deanSigningDelegations.active,
      note: deanSigningDelegations.note,
      createdAt: deanSigningDelegations.createdAt,
      updatedAt: deanSigningDelegations.updatedAt,
    })
    .from(deanSigningDelegations)
    .innerJoin(faculties, eq(deanSigningDelegations.facultyId, faculties.id))
    .innerJoin(users, eq(deanSigningDelegations.delegateUserId, users.id))
    .where(facultyId ? eq(deanSigningDelegations.facultyId, facultyId) : undefined)
    .orderBy(deanSigningDelegations.facultyId, deanSigningDelegations.id);

  return rows.map(r => ({
    ...r,
    allowedTemplateIds: (r.allowedTemplateIds as number[]) ?? [],
  }));
}

export async function getDelegationById(id: number): Promise<DelegationListItem | null> {
  const [row] = await db
    .select({
      id: deanSigningDelegations.id,
      facultyId: deanSigningDelegations.facultyId,
      facultyNameEn: faculties.nameEn,
      facultyNameTh: faculties.nameTh,
      delegateUserId: deanSigningDelegations.delegateUserId,
      delegateNameEn: sql<string>`concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ' ', ${users.lastNameEn})`,
      delegateNameTh: sql<string>`concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`,
      delegateEmail: users.email,
      allowedTemplateIds: deanSigningDelegations.allowedTemplateIds,
      startDate: deanSigningDelegations.startDate,
      endDate: deanSigningDelegations.endDate,
      active: deanSigningDelegations.active,
      note: deanSigningDelegations.note,
      createdAt: deanSigningDelegations.createdAt,
      updatedAt: deanSigningDelegations.updatedAt,
    })
    .from(deanSigningDelegations)
    .innerJoin(faculties, eq(deanSigningDelegations.facultyId, faculties.id))
    .innerJoin(users, eq(deanSigningDelegations.delegateUserId, users.id))
    .where(eq(deanSigningDelegations.id, id))
    .limit(1);

  if (!row)
    return null;
  return { ...row, allowedTemplateIds: (row.allowedTemplateIds as number[]) ?? [] };
}

export async function createDelegation(input: CreateDelegationInput) {
  const [row] = await db
    .insert(deanSigningDelegations)
    .values({
      facultyId: input.facultyId,
      delegateUserId: input.delegateUserId,
      allowedTemplateIds: input.allowedTemplateIds ?? [],
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      active: input.active ?? true,
      note: input.note ?? null,
    })
    .returning();
  return row;
}

export async function updateDelegation(id: number, input: UpdateDelegationInput) {
  const updatePayload: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (input.facultyId !== undefined)
    updatePayload.facultyId = input.facultyId;
  if (input.delegateUserId !== undefined)
    updatePayload.delegateUserId = input.delegateUserId;
  if (input.allowedTemplateIds !== undefined)
    updatePayload.allowedTemplateIds = input.allowedTemplateIds;
  if (input.startDate !== undefined)
    updatePayload.startDate = input.startDate ?? null;
  if (input.endDate !== undefined)
    updatePayload.endDate = input.endDate ?? null;
  if (input.active !== undefined)
    updatePayload.active = input.active;
  if (input.note !== undefined)
    updatePayload.note = input.note ?? null;

  const [row] = await db
    .update(deanSigningDelegations)
    .set(updatePayload)
    .where(eq(deanSigningDelegations.id, id))
    .returning();
  return row ?? null;
}

export async function deleteDelegation(id: number) {
  const [row] = await db
    .delete(deanSigningDelegations)
    .where(eq(deanSigningDelegations.id, id))
    .returning();
  return row ?? null;
}

/**
 * Returns active delegations where the given user is the delegate,
 * filtered to the current time window. Used to check signing eligibility.
 */
export async function getActiveDelegationsForUser(delegateUserId: string): Promise<Array<{
  facultyId: number;
  allowedTemplateIds: number[];
}>> {
  const now = new Date().toISOString();
  const rows = await db
    .select({
      facultyId: deanSigningDelegations.facultyId,
      allowedTemplateIds: deanSigningDelegations.allowedTemplateIds,
    })
    .from(deanSigningDelegations)
    .where(and(
      eq(deanSigningDelegations.delegateUserId, delegateUserId),
      eq(deanSigningDelegations.active, true),
      or(isNull(deanSigningDelegations.startDate), lte(deanSigningDelegations.startDate, now)),
      or(isNull(deanSigningDelegations.endDate), gte(deanSigningDelegations.endDate, now)),
    ));

  return rows.map(r => ({
    facultyId: r.facultyId,
    allowedTemplateIds: (r.allowedTemplateIds as number[]) ?? [],
  }));
}

/**
 * Returns true if the given user is an active delegate for the given
 * facultyId + templateId combination at the current time.
 */
export async function isActiveDelegateForRequest(
  userId: string,
  facultyId: number,
  templateId: number,
): Promise<boolean> {
  const delegateIds = await getActiveDelegateIds(facultyId, templateId);
  return delegateIds.has(userId);
}

export async function getActiveDelegateIds(facultyId: number, templateId: number): Promise<Set<string>> {
  const now = new Date().toISOString();
  const rows = await db
    .select({ delegateUserId: deanSigningDelegations.delegateUserId })
    .from(deanSigningDelegations)
    .where(and(
      eq(deanSigningDelegations.facultyId, facultyId),
      eq(deanSigningDelegations.active, true),
      or(isNull(deanSigningDelegations.startDate), lte(deanSigningDelegations.startDate, now)),
      or(isNull(deanSigningDelegations.endDate), gte(deanSigningDelegations.endDate, now)),
      or(
        sql`jsonb_array_length(${deanSigningDelegations.allowedTemplateIds}) = 0`,
        sql`${deanSigningDelegations.allowedTemplateIds} @> ${JSON.stringify([templateId])}::jsonb`,
      ),
    ));
  return new Set(rows.map(r => r.delegateUserId));
}

/**
 * Returns users eligible to sign a dean step for the given facultyId + templateId.
 * Includes actual deans (role 'dean', same faculty) and active delegates.
 */
export async function getEligibleDeanSigners(deanRoleId: number, facultyId: number, templateId: number) {
  const now = new Date().toISOString();

  const deans = await db
    .select({
      id: users.id,
      fullNameEn: sql<string>`concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ' ', ${users.lastNameEn})`,
      fullNameTh: sql<string>`concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`,
      email: users.email,
      isDelegate: sql<boolean>`false`,
    })
    .from(users)
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .where(and(
      eq(userRoles.roleId, deanRoleId),
      eq(userRoles.facultyId, facultyId),
    ));

  const delegates = await db
    .select({
      id: users.id,
      fullNameEn: sql<string>`concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ' ', ${users.lastNameEn})`,
      fullNameTh: sql<string>`concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`,
      email: users.email,
      isDelegate: sql<boolean>`true`,
    })
    .from(users)
    .innerJoin(deanSigningDelegations, eq(users.id, deanSigningDelegations.delegateUserId))
    .where(and(
      eq(deanSigningDelegations.facultyId, facultyId),
      eq(deanSigningDelegations.active, true),
      or(isNull(deanSigningDelegations.startDate), lte(deanSigningDelegations.startDate, now)),
      or(isNull(deanSigningDelegations.endDate), gte(deanSigningDelegations.endDate, now)),
      or(
        sql`jsonb_array_length(${deanSigningDelegations.allowedTemplateIds}) = 0`,
        sql`${deanSigningDelegations.allowedTemplateIds} @> ${JSON.stringify([templateId])}::jsonb`,
      ),
    ));

  // Merge — deans take priority if also a delegate
  const seen = new Set<string>();
  const result: Array<{
    id: string;
    fullNameEn: string;
    fullNameTh: string;
    email: string;
    isDelegate: boolean;
  }> = [];

  for (const user of [...deans, ...delegates]) {
    if (!seen.has(user.id)) {
      seen.add(user.id);
      result.push(user);
    }
  }

  return result;
}
