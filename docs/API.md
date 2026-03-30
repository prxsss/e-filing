# e-Filing API Documentation

## Overview

The e-Filing API is the backend interface for the e-Filing application, a Nuxt.js-based electronic document filing system tailored for institutional use (e.g., Kasetsart University - KU). It supports PDF template management, digital signing, user/role/permission management, departmental workflows, notifications, and request handling.

### Design Philosophy and Conventions
- **RESTful principles**: Resources are organized hierarchically (e.g., `/api/users`, `/api/requests`).
- **HTTP methods**: Standard CRUD operations (GET for read/list, POST for create, PUT/PATCH for update, DELETE for delete).
- **Content-Type**: `application/json` for requests and responses.
- **Naming**: Kebab-case paths, snake_case for database fields (via Drizzle ORM configuration).
- **Pagination**: Supported via query params (e.g., `page`, `limit`) where applicable, using `use-pagination.js` composable.
- **Validation**: Zod schemas inferred from types (e.g., `types/department.ts`, `types/user.ts`).
- **Database**: PostgreSQL via Drizzle ORM; Supabase for auxiliary services.
- **File handling**: PDF operations with `pdf-lib`, font embedding (Sarabun fonts), and canvas-based signing (`signature-canvas.vue`, `use-pdf-signing.js`).
- **Real-time**: Socket.io for notifications (`use-socket.ts`, `server/plugins/socket.io.ts`).
- **Emails**: Nodemailer/Resend integration for notifications (`server/utils/email`).
- **Security**: Auth middleware (`server/middleware/require-auth.ts`), permissions (`server/utils/permission.ts`).

All endpoints are prefixed under `/api`.

## Authentication

Authentication is managed via [Nuxt Auth Utils](https://nuxt.com/modules/auth-utils) with OpenID Connect (OIDC) integration for KU-AllLogin:
- **Providers**: KU-AllLogin (via `CLIENT_ID`, `CLIENT_SECRET`, endpoints in `.env`).
- **Session**: Cookie-based sessions (`NUXT_SESSION_PASSWORD`).
- **Protected routes**: Use `server/middleware/require-auth.ts` and `app/middleware/permission.ts`.
- **Flows**:
  - Login: Redirect to `/api/auth/signin` or KU-AllLogin.
  - Callback: `/api/auth/callback`.
  - Logout: `/api/auth/signout`.
- **Scopes**: Configurable via `SCOPE` in `.env`.
- **Client usage**: Use `stores/auth.ts` and `composables/user-users.ts` for session state.
- **Permissions**: Role-based access control (RBAC) via `roles`, `permissions`, `user-role` endpoints.

Unauthenticated requests to protected endpoints return `401 Unauthorized`.

## Base URL

```
https://your-domain.com/api
```
- Dev: `http://localhost:3000/api`
- Use `APP_URL` from `.env` for full URLs.

## Endpoints

Endpoints are organized by resource directories under `server/api`. Specific handler files (e.g., `*.post.ts`) define exact methods. Standard CRUD is assumed for directories unless specified. Responses follow `{ data: T, meta?: { pagination? } }`. Errors: `{ error: string, details?: any }` with HTTP status codes.

### Auth (`/api/auth`)
Manages authentication sessions and OIDC flows.
- **GET /api/auth/me**  
  Description: Get current user profile.  
  Auth: Required.  
  Response: `200 { user: User }` (from `types/user.ts`).  
  Errors: `401`.

Assumed additional: `/api/auth/signin`, `/api/auth/signout`, `/api/auth/callback`.

### Users (`/api/users`)
CRUD operations for users, integrated with Supabase and KU-AllLogin.
- **GET /api/users**  
  Description: List users (filtered by status via `utils/user-status.ts`).  
  Query: `?page=1&limit=10&search=query`.  
  Auth: Admin required.  
  Response: `200 { data: User[], meta: { pagination } }`.

- **POST /api/users**  
  Description: Create user (bulk import via PapaParse?).  
  Body: `{ users: User[] }`.  
  Auth: Admin.

- **GET /api/users/:id**  
  Description: Get user by ID.

- **PUT /api/users/:id**  
  Description: Update user.

- **DELETE /api/users/:id**  
  Description: Delete user.

Errors: `403 Forbidden` (permissions), `404 Not Found`.

### Profile (`/api/profile`)
User-specific profile management.
- **GET /api/profile**  
  Description: Get current user profile.  
  Auth: Required.  
  Response: `200 { profile: User }`.

- **PUT /api/profile**  
  Description: Update profile.  
  Body: Partial `User`.

### Departments (`/api/departments`)
Manage departments (from `types/department.ts`, `composables/use-departments.ts`).
- **GET /api/departments**  
  Description: List departments.

- **POST /api/departments**  
  Description: Create department.  
  Body: `{ name: string, facultyId?: string }`.

- **GET /api/departments/:id**

- **PUT /api/departments/:id**

- **DELETE /api/departments/:id**

### Faculties (`/api/faculties`)
Manage faculties (from `types/faculty.ts`, `composables/use-faculties.ts`).
Similar CRUD to departments.

### Roles (`/api/roles`)
Manage roles for RBAC.
- **GET /api/roles**  
  Description: List roles.

- **POST /api/roles**

- **GET /api/roles/:id**

- **PUT /api/roles/:id**

- **DELETE /api/roles/:id**

### Permissions (`/api/permissions`)
Manage granular permissions (`server/utils/permission.ts`).
- **GET /api/permissions**  
  Description: List permissions.

Similar CRUD.

### User-Role (`/api/user-role`)
Assign roles to users.
- **POST /api/user-role**  
  Description: Assign role to user.  
  Body: `{ userId: string, roleId: string }`.

- **DELETE /api/user-role**  
  Description: Remove role assignment.  
  Params: `?userId=string&roleId=string`.

### PDF Templates (`/api/pdf-templates`)
Manage PDF form templates (`use-pdf-form-builder.js`, `types/template.ts`).
- **GET /api/pdf-templates**  
  Description: List templates.

- **POST /api/pdf-templates**  
  Description: Create template.

CRUD for `:id`.

### Template Fields (`/api/template-fields`)
Manage fields in PDF templates (`utils/place-field.ts`, `utils/template-field-clipboard.ts`).
- **GET /api/template-fields**  
  Params: `?templateId=string`.

- **POST /api/template-fields**  
  Body: Field data (position, type from `components/field`).

CRUD for `:id`.

### Requests (`/api/requests`)
Core filing requests (`utils/request-status.ts`, `utils/build-filled-pdf-for-request.ts`).
- **GET /api/requests**  
  Description: List requests (dashboard filters via `stores/request-filters.ts`, `utils/dashboard-period.ts`).  
  Query: `?status=pending&page=1&period=month`.

- **POST /api/requests**  
  Description: Create filing request.  
  Body: `{ templateId: string, fields: Record<string, any> }`.

- **GET /api/requests/:id**

- **PUT /api/requests/:id** (update status)

- **DELETE /api/requests/:id`

Related: Filled PDFs in `public/uploads/filled-requests`.

### Notifications (`/api/notifications`)
Manage notifications (`components/notification-bell.vue`, `services/sign-notification.service.ts`).
- **GET /api/notifications**  
  Description: List user notifications.

- **POST /api/notifications** (mark read?)

### Admin (`/api/admin`)
Admin-only operations (e.g., bulk actions).

### Specific Endpoints

#### POST /api/preview-template-pdf
Description: Preview a filled PDF template (`use-pdf-operations.js`).  
Auth: Required.  
Request Body:  
```json
{
  "templateId": "string",
  "fields": { "fieldName": "value" }
}
```
Response: `200 { pdfUrl: string }` (base64 or URL).  
Errors: `400 Bad Request` (invalid fields), `404`.

Example:
```
POST /api/preview-template-pdf
Content-Type: application/json
Authorization: session cookie

{"templateId": "tmpl_123", "fields": {"name": "John Doe"}}
```
```json
{"pdfUrl": "/uploads/preview-abc.pdf"}
```

#### POST /api/upload-template-file
Description: Upload PDF template file.  
Auth: Required (admin?).  
Request: Multipart form `file` (PDF).  
Response: `201 { templateId: string }`.  
Errors: `413 Payload Too Large`.

Example:
```
POST /api/upload-template-file
Content-Type: multipart/form-data

file: General-Request.pdf
```
```json
{"templateId": "tmpl_new"}
```

## Rate Limiting
Not explicitly implemented in provided codebase.

## Webhooks
Not implemented in provided codebase. Real-time updates use Socket.io (`use-socket.ts`).