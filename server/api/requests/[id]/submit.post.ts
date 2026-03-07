import { eq, inArray } from 'drizzle-orm';

import db from '../../../../lib/db';
import { request, requestTemplate, roles, signatureFlow } from '../../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!requestId) {
      return { success: false, error: 'Invalid request ID' };
    }

    const [requestData] = await db
      .select()
      .from(request)
      .where(eq(request.id, requestId))
      .limit(1);

    if (!requestData) {
      return { success: false, error: 'Request not found' };
    }

    if (requestData.status !== 'draft') {
      return { success: false, error: 'Request is not in draft status' };
    }

    const [template] = await db
      .select()
      .from(requestTemplate)
      .where(eq(requestTemplate.id, Number(requestData.templateId)))
      .limit(1);

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    const signingSteps = (template.signingFlowData as any[]) || [];

    // Create signature_flow entries sorted by order
    const sorted = [...signingSteps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (sorted.length > 0) {
      // Resolve roleIds: prefer stored roleId, fallback to lookup by roleName
      const needsLookup = sorted.filter(s => !s.roleId || Number.isNaN(Number(s.roleId)));
      const roleNameMap = new Map<string, number>();
      if (needsLookup.length > 0) {
        const roleNames = [...new Set(needsLookup.map((s: any) => s.roleName))];
        const foundRoles = await db
          .select({ id: roles.id, name: roles.name })
          .from(roles)
          .where(inArray(roles.name, roleNames));
        foundRoles.forEach(r => roleNameMap.set(r.name, r.id));
      }

      const flowEntries = sorted.map((step: any, index: number) => {
        const resolvedRoleId = (step.roleId && !Number.isNaN(Number(step.roleId)))
          ? Number(step.roleId)
          : (roleNameMap.get(step.roleName) ?? 0);
        return {
          requestId,
          stepId: step.id,
          stepOrder: step.order ?? index + 1,
          roleId: resolvedRoleId,
          roleName: step.roleName,
          assignedFieldInstanceIds: step.assignedFieldInstanceIds ?? [],
          status: index === 0 ? 'pending' : 'waiting',
        };
      });

      await db.insert(signatureFlow).values(flowEntries);
    }

    const newStatus = sorted.length > 0 ? 'pending_signature' : 'submitted';

    await db
      .update(request)
      .set({ status: newStatus, submittedAt: new Date() })
      .where(eq(request.id, requestId));

    return { success: true, data: { status: newStatus } };
  }
  catch (error: any) {
    console.error('Error submitting request:', error);
    return { success: false, error: error.message || 'Failed to submit request' };
  }
});
