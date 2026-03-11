import { pgTable, serial, text, foreignKey, unique, boolean, integer, timestamp, varchar, bigint, jsonb, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const faculties = pgTable("faculties", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
});

export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	firstNameEn: text("first_name_en").notNull(),
	lastNameEn: text("last_name_en").notNull(),
	firstNameTh: text("first_name_th"),
	lastNameTh: text("last_name_th"),
	email: text().notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	passwordHash: text("password_hash").notNull(),
	facultyId: integer("faculty_id"),
	image: text(),
	banned: boolean().default(false).notNull(),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.facultyId],
			foreignColumns: [faculties.id],
			name: "users_faculty_id_faculties_id_fk"
		}),
	unique("users_email_unique").on(table.email),
]);

export const permissions = pgTable("permissions", {
	id: serial().primaryKey().notNull(),
	code: varchar({ length: 50 }).notNull(),
	descriptionEn: text("description_en"),
	descriptionTh: text("description_th"),
}, (table) => [
	unique("permissions_code_unique").on(table.code),
]);

export const signatures = pgTable("signatures", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "signatures_id_seq1", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requestId: bigint("request_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	signatureFlowId: bigint("signature_flow_id", { mode: "number" }),
	userId: text("user_id").notNull(),
	fieldInstanceId: text("field_instance_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const signatureFlow = pgTable("signature_flow", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "signature_flow_id_seq1", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requestId: bigint("request_id", { mode: "number" }).notNull(),
	stepId: text("step_id").notNull(),
	stepOrder: integer("step_order").notNull(),
	roleId: integer("role_id").notNull(),
	roleName: text("role_name").notNull(),
	assignedFieldInstanceIds: jsonb("assigned_field_instance_ids"),
	status: text().default('waiting').notNull(),
	signedBy: text("signed_by"),
	signedAt: timestamp("signed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const attachments = pgTable("attachments", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "attachments_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requestId: bigint("request_id", { mode: "number" }),
	fileName: text("file_name"),
	fileUrl: text("file_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [request.id],
			name: "attachments_request_id_fkey"
		}),
]);

export const notifications = pgTable("notifications", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "notifications_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }),
	message: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	authUserId: text("auth_user_id"),
	isRead: boolean("is_read").default(false).notNull(),
});

export const auditLogs = pgTable("audit_logs", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "audit_logs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requestId: bigint("request_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	performedBy: bigint("performed_by", { mode: "number" }),
	action: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	authPerformedBy: text("auth_performed_by"),
});

export const request = pgTable("request", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "request_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	templateId: bigint("template_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdBy: bigint("created_by", { mode: "number" }),
	status: text(),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	filledDocumentUrl: text("filled_document_url"),
	userId: text("user_id"),
	note: text(),
});

export const requestTemplate = pgTable("request_template", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "request_template_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	name: text(),
	description: text(),
	tag: text(),
	version: text(),
	isActive: boolean("is_active"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdBy: bigint("created_by", { mode: "number" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	category: text(),
	documentUrl: text("document_url"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	documentWidth: bigint("document_width", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	documentHeight: bigint("document_height", { mode: "number" }),
	placedFieldsData: jsonb("placed_fields_data"),
	signingFlowData: jsonb("signing_flow_data"),
});

export const requestTemplateValues = pgTable("request_template_values", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "request_template_values_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requestId: bigint("request_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fieldId: bigint("field_id", { mode: "number" }),
	value: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [request.id],
			name: "request_template_values_request_id_fkey"
		}),
]);

export const signatureFlowOld = pgTable("signature_flow_old", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "signature_flow_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requestId: bigint("request_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	signerId: bigint("signer_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	order: bigint({ mode: "number" }),
	status: text(),
	signedAt: timestamp("signed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	signerUserId: text("signer_user_id"),
});

export const roles = pgTable("roles", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 50 }).notNull(),
	descriptionEn: text("description_en"),
	descriptionTh: text("description_th"),
}, (table) => [
	unique("roles_name_unique").on(table.name),
]);

export const signaturesOld = pgTable("signatures_old", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "signatures_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }),
	type: text(),
	data: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const requestTemplateFields = pgTable("request_template_fields", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "request_template_fields_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	type: text().notNull(),
	label: text().notNull(),
	font: text().default('Prompt'),
	fontSize: integer("font_size").default(14),
	isFillable: boolean("is_fillable").default(true),
	width: integer().notNull(),
	height: integer().notNull(),
	icon: text().notNull(),
	amount: integer().default(1),
});

export const rolePermissions = pgTable("role_permissions", {
	roleId: integer("role_id").notNull(),
	permissionId: integer("permission_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [permissions.id],
			name: "role_permissions_permission_id_permissions_id_fk"
		}),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "role_permissions_role_id_roles_id_fk"
		}),
	primaryKey({ columns: [table.roleId, table.permissionId], name: "role_permissions_role_id_permission_id_pk"}),
]);

export const userRoles = pgTable("user_roles", {
	userId: text("user_id").notNull(),
	roleId: integer("role_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "user_roles_role_id_roles_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_roles_user_id_users_id_fk"
		}),
	primaryKey({ columns: [table.userId, table.roleId], name: "user_roles_user_id_role_id_pk"}),
]);
