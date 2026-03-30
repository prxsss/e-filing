# e-filing API Documentation

## Overview

The e-filing API is a RESTful backend API powering the e-filing application, built using Nuxt 3 server routes (`server/api/`). It supports an electronic document filing system for Kasetsart University (KU), featuring PDF template management, form field placement, digital signing, user/role/permission management, departmental workflows, notifications, and request handling. 

Key features:
- PDF operations (uploading templates, previewing filled PDFs, signing).
- CRUD operations for users, roles, permissions, departments, faculties, templates, and requests.
- Real-time notifications via Socket.IO (handled separately via `/socket.io/`).
- Integration with Supabase for database (PostgreSQL via Drizzle ORM) and authentication.
- Multi-language support (English/Thai via `@nuxtjs/i18n`).
- Conventions:
  - JSON request/response bodies.
  - Snake_case for database fields (via Drizzle config), but camelCase or PascalCase in API responses inferred from TypeScript types (`types/`).
  - Standard HTTP methods (GET, POST, PUT, DELETE, PATCH).
  - Pagination via `use-pagination.js` composable (likely query params like `page`, `limit`).
  - Error responses: `{ error: string, details?: any }` with HTTP status codes (e.g., 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Validation Error).
  - File uploads use `multipart/form-data` (e.g., PDF templates).
  - Validation via Zod (inferred from dependencies).

Endpoints are auto-generated from `server/api/` structure:
- `server/api/resource.get.ts` → `GET /api/resource`
- `server/api/resource.post.ts` → `POST /api/resource`
- `server/api/resource/[id].get.ts` → `GET /api/resource/:id`
- Direct files like `preview-template-pdf.post.ts` → `POST /api/preview-template-pdf`.

Only documented endpoints are those explicitly indicated by the file structure. Subdirectory contents (e.g., `server/api/requests/`) imply standard CRUD routes, corroborated by composables (e.g., `use-departments.ts` fetches `/api/departments`).

## Authentication

Authentication is required for all endpoints except public auth routes (e.g., login). Uses:
- **nuxt-auth-utils** for session management (cookies).
- **Supabase** (`@supabase/supabase-js`) for user storage and OIDC integration (KU-AllLogin via OpenID Connect in `.env`).
- Server middleware: `require-auth.ts` protects private routes.
- Custom `/api/auth/` routes for login/logout.
- Permissions checked via `server/utils/permission.ts` and `/api/permissions`.
- Roles via `/api/roles` and `/api/user-role`.
- Incoming requests include session cookie; validated server-side.
- Student/admin/signer roles inferred from pages (`pages/admin/`, `pages/student/`, `pages/signer/`).

**Login Flow**:
1. POST `/api/auth/login` (or OIDC redirect).
2. Receive session cookie.
3. Use `stores/auth.ts` client-side.

**Logout**: POST/DELETE `/api/auth/logout`.

Unauthorized: 401. Forbidden (insufficient perms): 403.

## Base URL

```
/api
```

Full example: `https://your-app.com/api/users` (APP_URL from `.env`).

Development: `http://localhost:3000/api`.

## Endpoints

Endpoints grouped by resource. Descriptions inferred from file structure, composables, utils, and app context (e.g., PDF signing workflows via `use-pdf-signing.js`, requests via `stores/request-filters.ts`).

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Authenticate user (email/password or OIDC). Inferred from `server/api/auth/`, `stores/auth.ts`, `.env` OIDC config. |
| POST/DELETE | `/api/auth/logout` | Logout and clear session. |
| GET | `/api/auth/me` | Get current user profile (links to `/api/profile`). |

**Request Body (login)**: `{ email: string, password: string }` or OIDC params.

**Response (200)**: `{ user: User, session: Session }` (types from `types/user.ts`, `shared/auth.d.ts`).

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List users (paginated). Used by `user-users.ts`. Filters via `request-filters.ts`. |
| POST | `/api/users` | Create user (admin only). |
| GET | `/api/users/:id` | Get user by ID. |
| PUT/PATCH | `/api/users/:id` | Update user. |
| DELETE | `/api/users/:id` | Delete user (admin). |

**Query Params (GET list)**: `page?: number`, `limit?: number`, `search?: string`, `status?: string` (from `utils/user-status.ts`).

**Response (200, list)**: `{ data: User[], pagination: { page: number, limit: number, total: number } }`.

**User Schema** (from `types/user.ts`): `{ id: string, email: string, name: string, role: string, status: string, ... }`.

### Profile
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile` | Get current user profile. Linked to `pages/profile.vue`. |
| PUT/PATCH | `/api/profile` | Update profile. |

**Response**: `User` object.

### Roles
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/roles` | List roles. |
| POST | `/api/roles` | Create role. |
| GET | `/api/roles/:id` | Get role. |
| PUT | `/api/roles/:id` | Update role. |
| DELETE | `/api/roles/:id` | Delete role. |

### User-Role
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/user-role` | Assign role to user. |
| DELETE | `/api/user-role` | Remove role from user. |

**Body**: `{ userId: string, roleId: string }`.

### Permissions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/permissions` | List permissions. Checked via `server/utils/permission.ts`. |
| POST | `/api/permissions` | Create permission. |

### Departments
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/departments` | List departments. Used by `use-departments.ts`, `types/department.ts`. |
| POST | `/api/departments` | Create department. |
| GET | `/api/departments/:id` | Get department. |

**Response**: `{ data: Department[] }`. `Department`: `{ id: string, name: string, facultyId?: string, ... }`.

### Faculties
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/faculties` | List faculties. Used by `use-faculties.ts`, `types/faculty.ts`. |
| POST | `/api/faculties` | Create faculty. |

### Requests
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/requests` | List requests (filtered by status via `utils/request-status.ts`, dashboard via `utils/dashboard-period.ts`). |
| POST | `/api/requests` | Create filing request. |
| GET | `/api/requests/:id` | Get request (context via `utils/get-sign-request-context.ts`). |
| PUT | `/api/requests/:id` | Update request. |
| POST | `/api/requests/:id/fill` | Build filled PDF (via `utils/build-filled-pdf-for-request.ts`). |
| POST | `/api/requests/:id/sign` | Sign request (via `use-pdf-signing.js`, `signature-canvas.vue`). |

**Filters**: `status`, `period`, `departmentId`, etc.

**Pagination**: Supported.

### PDF Templates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pdf-templates` | List templates. |
| POST | `/api/pdf-templates` | Create template. |
| GET | `/api/pdf-templates/:id` | Get template. |
| **POST** | `/api/upload-template-file` | Upload PDF template file (`multipart/form-data`, field: `file`). Explicit file: `upload-template-file.post.ts`. |
| POST | `/api/pdf-templates/:id/preview` | Preview filled template. Links to `preview-template-pdf.post.ts`. |

**Upload Body**: `formData: { file: File (PDF) }`.

**Response (preview)**: Binary PDF stream or base64.

### Template Fields
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/template-fields` | List fields for template (via `utils/template-field-clipboard.ts`, `utils/place-field.ts`). |
| POST | `/api/template-fields` | Add field (used by `use-pdf-form-builder.js`). |
| PUT | `/api/template-fields/:id` | Update field position/size (via `use-coordinate-conversion.js`, `use-canvas-operations.js`). |
| DELETE | `/api/template-fields/:id` | Delete field. |

**Field Types**: Signature, text, checkbox (inferred from `components/field/`, `shared/form-field-required.ts`).

### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List notifications (bell via `notification-bell.vue`). |
| POST | `/api/notifications` | Mark as read. |
| POST | `/api/notifications/sign` | Sign notification service (`services/sign-notification.service.ts`). |

Real-time via `use-socket.ts`, `server/plugins/socket.io.ts`.

### Admin
Admin-only namespace (`pages/admin/`, middleware `permission.ts`).
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/... | `/api/admin/*` | Admin CRUD (users, requests, etc.). Specifics in `server/api/admin/`. |

## Rate Limiting

Not explicitly implemented in provided structure. Relies on Supabase/PostgreSQL limits.

## Webhooks

No webhook endpoints in structure. Notifications use Socket.IO and email (`utils/email/`, Nodemailer/Resend).