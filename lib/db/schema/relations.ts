import { relations } from "drizzle-orm/relations";
import { users, userSignatures, departments, userRoles, faculties, roles, request, signatures, signatureFlow, attachments, requestTemplateValues, activationOtps, notifications, deanSigningDelegations, permissions, rolePermissions, permissionPresetPermissions, permissionPresets } from "./schema";

export const userSignaturesRelations = relations(userSignatures, ({one, many}) => ({
	user: one(users, {
		fields: [userSignatures.userId],
		references: [users.id]
	}),
	signatures: many(signatures),
}));

export const usersRelations = relations(users, ({many}) => ({
	userSignatures: many(userSignatures),
	userRoles: many(userRoles),
	signatures: many(signatures),
	activationOtps: many(activationOtps),
	notifications: many(notifications),
	deanSigningDelegations: many(deanSigningDelegations),
	requests: many(request),
	signatureFlows_assignedUserId: many(signatureFlow, {
		relationName: "signatureFlow_assignedUserId_users_id"
	}),
	signatureFlows_signedBy: many(signatureFlow, {
		relationName: "signatureFlow_signedBy_users_id"
	}),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	department: one(departments, {
		fields: [userRoles.departmentId],
		references: [departments.id]
	}),
	faculty: one(faculties, {
		fields: [userRoles.facultyId],
		references: [faculties.id]
	}),
	role: one(roles, {
		fields: [userRoles.roleId],
		references: [roles.id]
	}),
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id]
	}),
}));

export const departmentsRelations = relations(departments, ({one, many}) => ({
	userRoles: many(userRoles),
	faculty: one(faculties, {
		fields: [departments.facultyId],
		references: [faculties.id]
	}),
	requests: many(request),
}));

export const facultiesRelations = relations(faculties, ({many}) => ({
	userRoles: many(userRoles),
	departments: many(departments),
	deanSigningDelegations: many(deanSigningDelegations),
	requests: many(request),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	userRoles: many(userRoles),
	signatureFlows: many(signatureFlow),
	rolePermissions: many(rolePermissions),
}));

export const signaturesRelations = relations(signatures, ({one}) => ({
	request: one(request, {
		fields: [signatures.requestId],
		references: [request.id]
	}),
	signatureFlow: one(signatureFlow, {
		fields: [signatures.signatureFlowId],
		references: [signatureFlow.id]
	}),
	user: one(users, {
		fields: [signatures.userId],
		references: [users.id]
	}),
	userSignature: one(userSignatures, {
		fields: [signatures.userSignatureId],
		references: [userSignatures.id]
	}),
}));

export const requestRelations = relations(request, ({one, many}) => ({
	signatures: many(signatures),
	attachments: many(attachments),
	requestTemplateValues: many(requestTemplateValues),
	department: one(departments, {
		fields: [request.departmentId],
		references: [departments.id]
	}),
	faculty: one(faculties, {
		fields: [request.facultyId],
		references: [faculties.id]
	}),
	user: one(users, {
		fields: [request.userId],
		references: [users.id]
	}),
	signatureFlows: many(signatureFlow),
}));

export const signatureFlowRelations = relations(signatureFlow, ({one, many}) => ({
	signatures: many(signatures),
	user_assignedUserId: one(users, {
		fields: [signatureFlow.assignedUserId],
		references: [users.id],
		relationName: "signatureFlow_assignedUserId_users_id"
	}),
	request: one(request, {
		fields: [signatureFlow.requestId],
		references: [request.id]
	}),
	role: one(roles, {
		fields: [signatureFlow.roleId],
		references: [roles.id]
	}),
	user_signedBy: one(users, {
		fields: [signatureFlow.signedBy],
		references: [users.id],
		relationName: "signatureFlow_signedBy_users_id"
	}),
}));

export const attachmentsRelations = relations(attachments, ({one}) => ({
	request: one(request, {
		fields: [attachments.requestId],
		references: [request.id]
	}),
}));

export const requestTemplateValuesRelations = relations(requestTemplateValues, ({one}) => ({
	request: one(request, {
		fields: [requestTemplateValues.requestId],
		references: [request.id]
	}),
}));

export const activationOtpsRelations = relations(activationOtps, ({one}) => ({
	user: one(users, {
		fields: [activationOtps.userId],
		references: [users.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));

export const deanSigningDelegationsRelations = relations(deanSigningDelegations, ({one}) => ({
	user: one(users, {
		fields: [deanSigningDelegations.delegateUserId],
		references: [users.id]
	}),
	faculty: one(faculties, {
		fields: [deanSigningDelegations.facultyId],
		references: [faculties.id]
	}),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({one}) => ({
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id]
	}),
	role: one(roles, {
		fields: [rolePermissions.roleId],
		references: [roles.id]
	}),
}));

export const permissionsRelations = relations(permissions, ({many}) => ({
	rolePermissions: many(rolePermissions),
	permissionPresetPermissions: many(permissionPresetPermissions),
}));

export const permissionPresetPermissionsRelations = relations(permissionPresetPermissions, ({one}) => ({
	permission: one(permissions, {
		fields: [permissionPresetPermissions.permissionId],
		references: [permissions.id]
	}),
	permissionPreset: one(permissionPresets, {
		fields: [permissionPresetPermissions.presetId],
		references: [permissionPresets.id]
	}),
}));

export const permissionPresetsRelations = relations(permissionPresets, ({many}) => ({
	permissionPresetPermissions: many(permissionPresetPermissions),
}));