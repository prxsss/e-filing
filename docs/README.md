```markdown
# e-filing Documentation Index

Welcome to the documentation for **e-filing**, a Nuxt.js application for electronic document filing, PDF form building, signing, and management. It includes KU-specific features and supports roles like admin, student, and signer. Key components include `signature-canvas.vue`, `notification-bell.vue`, `table-pagination.vue`, `ku-logo.vue`, plus `admin/*`, `field/*`, and `form/*` modules.

This index provides quick access to all docs in `/docs`.

## Documentation Index

- [GETTING-STARTED.md](./GETTING-STARTED.md) - Local setup, dependencies, and running the app.
- [ARCHITECTURE.md](./ARCHITECTURE.md) - High-level overview, roles (admin/student/signer), and data flow.
- [COMPONENTS.md](./COMPONENTS.md) - Reusable components: `signature-canvas.vue`, `notification-bell.vue`, `table-pagination.vue`, `ku-logo.vue`.
- [ADMIN.md](./ADMIN.md) - Admin dashboard features and `admin/*` implementation.
- [FORMS.md](./FORMS.md) - PDF form building, signing, and `field/*`/`form/*` modules.
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment and KU-specific configs.
- [API-ROUTES.md](./API-ROUTES.md) - Nuxt server routes for filing and management.

## Quick Links

| Document | Description | When to Read |
|----------|-------------|--------------|
| [GETTING-STARTED.md](./GETTING-STARTED.md) | Install, run, and troubleshoot locally | First-time setup |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | App structure, roles, and workflows | Onboarding new devs |
| [COMPONENTS.md](./COMPONENTS.md) | Core UI components docs | Building/extending UI |
| [ADMIN.md](./ADMIN.md) | Admin tools and permissions | Admin feature work |
| [FORMS.md](./FORMS.md) | Form/PDF handling and signing | Form/signature changes |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deploy to production | Release process |
| [API-ROUTES.md](./API-ROUTES.md) | Backend endpoints | API integrations |

## Reading Order (for New Developers)

1. **[GETTING-STARTED.md](./GETTING-STARTED.md)** - Get the app running.
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Understand the big picture.
3. **[COMPONENTS.md](./COMPONENTS.md)** - Learn UI building blocks.
4. **[ADMIN.md](./ADMIN.md)** or **[FORMS.md](./FORMS.md)** - Dive into your focus area.
5. **[API-ROUTES.md](./API-ROUTES.md)** and **[DEPLOYMENT.md](./DEPLOYMENT.md)** - For advanced work.

## Contributing to Docs

- Edit `.md` files directly in `/docs`.
- Use Markdown previews (e.g., VS Code, GitHub).
- Keep docs concise, code-referenced, and up-to-date with changes to components like `signature-canvas.vue` or `form/*`.
- Test links and submit PRs with changes reflected in code.
- Run `npm run dev` to verify app/docs alignment.
```