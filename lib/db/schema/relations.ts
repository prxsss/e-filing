import { relations } from "drizzle-orm/relations";
import { departments, users, faculties, request, signatureFlow, roles, attachments, requestTemplateValues, permissions, rolePermissions, userRoles } from "./schema";

export const usersRelations = relations(users, ({one, many}) => ({
	department: one(departments, {
		fields: [users.departmentId],
		references: [departments.id],
		relationName: "users_departmentId_departments_id"
	}),
	faculties: many(faculties),
	departments: many(departments, {
		relationName: "departments_headUserId_users_id"
	}),
	userRoles: many(userRoles),
}));

export const departmentsRelations = relations(departments, ({one, many}) => ({
	users: many(users, {
		relationName: "users_departmentId_departments_id"
	}),
	user: one(users, {
		fields: [departments.headUserId],
		references: [users.id],
		relationName: "departments_headUserId_users_id"
	}),
	faculty: one(faculties, {
		fields: [departments.facultyId],
		references: [faculties.id]
	}),
}));

export const facultiesRelations = relations(faculties, ({one, many}) => ({
	user: one(users, {
		fields: [faculties.deanUserId],
		references: [users.id]
	}),
	departments: many(departments),
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

export const rolesRelations = relations(roles, ({many}) => ({
	signatureFlows: many(signatureFlow),
	rolePermissions: many(rolePermissions),
	userRoles: many(userRoles),
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

export const userRolesRelations = relations(userRoles, ({one}) => ({
	role: one(roles, {
		fields: [userRoles.roleId],
		references: [roles.id]
	}),
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id]
	}),
}));