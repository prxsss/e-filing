import { relations } from "drizzle-orm/relations";
import { faculties, users, request, attachments, requestTemplateValues, permissions, rolePermissions, roles, userRoles } from "./schema";

export const usersRelations = relations(users, ({one, many}) => ({
	faculty: one(faculties, {
		fields: [users.facultyId],
		references: [faculties.id]
	}),
	userRoles: many(userRoles),
}));

export const facultiesRelations = relations(faculties, ({many}) => ({
	users: many(users),
}));

export const attachmentsRelations = relations(attachments, ({one}) => ({
	request: one(request, {
		fields: [attachments.requestId],
		references: [request.id]
	}),
}));

export const requestRelations = relations(request, ({many}) => ({
	attachments: many(attachments),
	requestTemplateValues: many(requestTemplateValues),
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

export const rolesRelations = relations(roles, ({many}) => ({
	rolePermissions: many(rolePermissions),
	userRoles: many(userRoles),
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