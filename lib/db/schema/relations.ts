import { relations } from "drizzle-orm/relations";
import { departments, userRoles, faculties, roles, users, request, signatureFlow, attachments, requestTemplateValues, permissions, rolePermissions } from "../migrations/schema";

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
}));

export const facultiesRelations = relations(faculties, ({many}) => ({
	userRoles: many(userRoles),
	departments: many(departments),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	userRoles: many(userRoles),
	signatureFlows: many(signatureFlow),
	rolePermissions: many(rolePermissions),
}));

export const usersRelations = relations(users, ({many}) => ({
	userRoles: many(userRoles),
}));

export const signatureFlowRelations = relations(signatureFlow, ({one}) => ({
	request: one(request, {
		fields: [signatureFlow.requestId],
		references: [request.id]
	}),
	role: one(roles, {
		fields: [signatureFlow.roleId],
		references: [roles.id]
	}),
}));

export const requestRelations = relations(request, ({many}) => ({
	signatureFlows: many(signatureFlow),
	attachments: many(attachments),
	requestTemplateValues: many(requestTemplateValues),
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
}));