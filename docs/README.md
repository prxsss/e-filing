```markdown
# e-filing Documentation Index

Welcome to the documentation index for **e-filing**, a Nuxt.js application for electronic document filing, PDF form building, digital signing, and workflow management. It supports roles for admins, students, signers, and university departments/faculties.

This index links to key guides and references. All docs are in Markdown for easy updates.

## Documentation Index

- [Overview](./OVERVIEW.md) – Project architecture, features, and key concepts.
- [Getting Started](./GETTING-STARTED.md) – Local setup, dependencies, and running the app.
- [Components](./COMPONENTS.md) – UI components: `signature-canvas.vue`, `notification-bell.vue`, `table-pagination.vue`, `ku-logo.vue`.
- [Composables](./COMPOSABLES.md) – PDF utilities: `use-pdf-signing.js`, `use-pdf-form-builder.js`.
- [Roles & Workflows](./ROLES.md) – User roles, permissions, and document workflows.
- [Deployment](./DEPLOYMENT.md) – Production setup and best practices.

## Quick Links

| Document | Description | When to Read |
|----------|-------------|--------------|
| [Overview](./OVERVIEW.md) | High-level project intro and tech stack | Always first |
| [Getting Started](./GETTING-STARTED.md) | Dev environment setup | Onboarding new devs |
| [Components](./COMPONENTS.md) | Reusable Vue components | Building/extending UI |
| [Composables](./COMPOSABLES.md) | PDF signing and form logic | Implementing e-filing features |
| [Roles & Workflows](./ROLES.md) | Role-based access and processes | Customizing permissions |
| [Deployment](./DEPLOYMENT.md) | Hosting and scaling | Preparing for prod |

## Reading Order (for New Developers)

1. **[Overview](./OVERVIEW.md)** – Understand the big picture.
2. **[Getting Started](./GETTING-STARTED.md)** – Get the app running.
3. **[Components](./COMPONENTS.md)** & **[Composables](./COMPOSABLES.md)** – Core building blocks.
4. **[Roles & Workflows](./ROLES.md)** – App-specific logic.
5. **[Deployment](./DEPLOYMENT.md)** – Go live.

## Contributing to Docs

- Edit `.md` files directly in `/docs`.
- Use standard Markdown (headings, tables, code blocks).
- Preview locally: Run `nuxt dev` (docs auto-serve if configured) or use a Markdown viewer.
- Test links and keep concise. Submit PRs with changes.
- Regenerate index if adding docs: Update links/tables above.
```