CREATE TABLE "permission_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_th" varchar(100) NOT NULL,
	"description_en" text,
	"description_th" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "permission_presets_name_unique_ci" ON "permission_presets" USING btree (lower(("name")::text));
CREATE UNIQUE INDEX "permission_presets_name_th_unique_ci" ON "permission_presets" USING btree (lower(("name_th")::text));

CREATE TABLE "permission_preset_permissions" (
	"preset_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	CONSTRAINT "permission_preset_permissions_preset_id_permission_id_pk" PRIMARY KEY("preset_id","permission_id"),
	CONSTRAINT "permission_preset_permissions_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "permission_presets"("id") ON DELETE CASCADE,
	CONSTRAINT "permission_preset_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE
);

INSERT INTO "permissions" ("code", "description_en", "description_th")
VALUES
	('permission_preset.view', 'View permission presets', 'ดูชุดสิทธิ์สำเร็จรูป'),
	('permission_preset.create', 'Create permission presets', 'สร้างชุดสิทธิ์สำเร็จรูป'),
	('permission_preset.edit', 'Edit permission presets', 'แก้ไขชุดสิทธิ์สำเร็จรูป'),
	('permission_preset.delete', 'Delete permission presets', 'ลบชุดสิทธิ์สำเร็จรูป'),
	('permission_preset.apply', 'Apply permission presets to roles', 'นำชุดสิทธิ์สำเร็จรูปไปใช้กับบทบาท')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT "roles"."id", "permissions"."id"
FROM "roles"
CROSS JOIN "permissions"
WHERE lower("roles"."name") = 'admin'
	AND "permissions"."code" IN (
		'permission_preset.view',
		'permission_preset.create',
		'permission_preset.edit',
		'permission_preset.delete',
		'permission_preset.apply'
	)
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
