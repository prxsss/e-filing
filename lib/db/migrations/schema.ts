import { pgTable, unique, text, boolean, timestamp, varchar, serial, foreignKey, bigint, integer, jsonb, uniqueIndex, doublePrecision, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const notificationType = pgEnum("notification_type", ['sign_request', 'signed', 'completed', 'rejected', 'acknowledged'])
export const userStatus = pgEnum("user_status", ['active', 'inactive', 'banned'])


export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	firstNameEn: text("first_name_en").notNull(),
	lastNameEn: text("last_name_en").notNull(),
	firstNameTh: text("first_name_th").notNull(),
	lastNameTh: text("last_name_th").notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	passwordHash: text("password_hash"),
	image: text(),
	banned: boolean().default(false).notNull(),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	titleTh: varchar("title_th", { length: 20 }),
	titleEn: varchar("title_en", { length: 20 }),
	isActive: boolean("is_active").default(false),
	studentId: text("student_id"),
	staffId: text("staff_id"),
	status: userStatus().default('inactive').notNull(),
	provider: text().default('local').notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
	unique("users_student_id_key").on(table.studentId),
	unique("users_staff_id_key").on(table.staffId),
]);

export const permissions = pgTable("permissions", {
	id: serial().primaryKey().notNull(),
	code: varchar({ length: 50 }).notNull(),
	descriptionEn: text("description_en"),
	descriptionTh: text("description_th"),
}, (table) => [
	unique("permissions_code_unique").on(table.code),
]);

export const userSignatures = pgTable("user_signatures", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "user_signatures_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: text("user_id").notNull(),
	dataUrl: text("data_url").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_signatures_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	unique("user_signatures_user_id_key").on(table.userId),
]);

export const faculties = pgTable("faculties", {
	id: serial().primaryKey().notNull(),
	facultyCode: varchar("faculty_code", { length: 20 }).notNull(),
	nameEn: varchar("name_en", { length: 255 }).notNull(),
	nameTh: varchar("name_th", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("faculties_faculty_code_key").on(table.facultyCode),
]);

export const userRoles = pgTable("user_roles", {
	id: serial().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	roleId: integer("role_id").notNull(),
	facultyId: integer("faculty_id"),
	departmentId: integer("department_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "user_roles_department_id_fkey"
		}),
	foreignKey({
			columns: [table.facultyId],
			foreignColumns: [faculties.id],
			name: "user_roles_faculty_id_fkey"
		}),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "user_roles_role_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_roles_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const departments = pgTable("departments", {
	id: serial().primaryKey().notNull(),
	departmentCode: varchar("department_code", { length: 20 }).notNull(),
	nameEn: varchar("name_en", { length: 255 }).notNull(),
	nameTh: varchar("name_th", { length: 255 }).notNull(),
	facultyId: integer("faculty_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.facultyId],
			foreignColumns: [faculties.id],
			name: "departments_faculty_id_fkey"
		}),
	unique("departments_department_code_key").on(table.departmentCode),
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
	pdfHash: text("pdf_hash"),
	dataUrl: text("data_url"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userSignatureId: bigint("user_signature_id", { mode: "number" }),
}, (table) => [
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [request.id],
			name: "signatures_request_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.signatureFlowId],
			foreignColumns: [signatureFlow.id],
			name: "signatures_signature_flow_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "signatures_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userSignatureId],
			foreignColumns: [userSignatures.id],
			name: "signatures_user_signature_id_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const requestTemplate = pgTable("request_template", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "request_template_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	name: text(),
	description: text(),
	version: text(),
	isActive: boolean("is_active"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdBy: bigint("created_by", { mode: "number" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	documentUrl: text("document_url"),
	placedFieldsData: jsonb("placed_fields_data"),
	signingFlowData: jsonb("signing_flow_data"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	documentWidth: bigint("document_width", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	documentHeight: bigint("document_height", { mode: "number" }),
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
		}).onUpdate("cascade").onDelete("cascade"),
]);

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
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	filledDocumentUrl: text("filled_document_url"),
	userId: text("user_id"),
	note: text(),
	rejectionReasons: jsonb("rejection_reasons").default(sql`'{}'::jsonb`).notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	facultyId: integer("faculty_id"),
	departmentId: integer("department_id"),
}, (table) => [
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "request_department_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.facultyId],
			foreignColumns: [faculties.id],
			name: "request_faculty_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "request_user_id_fkey"
		}),
]);

export const requestTemplateValues = pgTable("request_template_values", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "request_template_values_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requestId: bigint("request_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fieldId: bigint("field_id", { mode: "number" }),
	value: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	fieldInstanceId: text("field_instance_id"),
}, (table) => [
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [request.id],
			name: "request_template_values_request_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const activationOtps = pgTable("activation_otps", {
	id: serial().primaryKey().notNull(),
	userId: text("user_id"),
	otp: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "activation_otps_user_id_fkey"
		}),
]);

export const roles = pgTable("roles", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 50 }).notNull(),
	descriptionEn: text("description_en"),
	descriptionTh: text("description_th"),
	nameTh: varchar("name_th", { length: 50 }).notNull(),
}, (table) => [
	uniqueIndex("roles_name_th_unique_ci").using("btree", sql`lower((name_th)::text)`),
	uniqueIndex("roles_name_unique_ci").using("btree", sql`lower((name)::text)`),
]);

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
	isAutoGenerated: boolean("is_auto_generated").default(false).notNull(),
	fontWeight: text("font_weight").default('normal'),
	fontStyle: text("font_style").default('normal'),
	textDecoration: text("text_decoration").default('none'),
	textAlign: text("text_align").default('left'),
	letterSpacing: doublePrecision("letter_spacing").default(0),
	lineHeight: doublePrecision("line_height").default(1.5),
	maxLength: integer("max_length"),
	strikeThroughGroupMode: boolean("strike_through_group_mode").default(false),
	strikeLineThickness: doublePrecision("strike_line_thickness").default(1.5),
	sessionField: text("session_field"),
	dateFormatConfig: jsonb("date_format_config").default({}),
	dropdownConfig: jsonb("dropdown_config").default({}),
});

export const notifications = pgTable("notifications", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "notifications_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: text("user_id"),
	messageEng: text("message_eng"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isRead: boolean("is_read").default(false).notNull(),
	type: notificationType().notNull(),
	link: text(),
	messageTh: text("message_th"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notifications_user_id_fkey"
		}),
]);

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
	assignedUserId: text("assigned_user_id"),
	pendingAt: timestamp("pending_at", { withTimezone: true, mode: 'string' }),
	acknowledgeOnly: boolean("acknowledge_only").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.assignedUserId],
			foreignColumns: [users.id],
			name: "signature_flow_assigned_user_id_fkey"
		}),
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [request.id],
			name: "signature_flow_request_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "signature_flow_role_id_fkey"
		}),
	foreignKey({
			columns: [table.signedBy],
			foreignColumns: [users.id],
			name: "signature_flow_signed_by_fkey"
		}),
]);

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
