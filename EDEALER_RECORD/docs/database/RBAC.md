# RBAC schema (roles, pages, actions)

Tables: `roles`, `modules`, `pages`, `page_actions`, `role_permissions`, `user_roles`.

## Concepts

- **Module** — Groups pages for navigation (e.g. Vehicles, Settings). `moduleType` is `DEALER` or `AGENT` so dealer UI and agent UI can differ.
- **Page** — One screen/route concept. `slug` is unique **inside** a module (not globally).
- **PageAction** — Atomic permission key on a page (e.g. `VIEW`, `CREATE`, `UPDATE`, `DELETE`, `EXPORT`). Unique per `(pageId, actionName)`.
- **Role** — `roleType` = dealer vs agent app. **`typeId`** (required) = dealer id or agent id; interpret with `roleType` (no polymorphic FK — validate in app). **`roleName` is unique per `typeId`** (`@@unique([typeId, roleName])`).
- **RolePermission** — One row = one grant (or explicit deny) for `(role, page, action)`. **No row = deny** when checking access.
- **UserRole** — Many-to-many: which users have which roles.

## Multi-tenancy

- List and assign roles for a dealer (or agent) using `Role.typeId` + `Role.roleType` and `UserRole`.

## Seeding

Seed `Module` → `Page` → `PageAction`, then create `Role` per dealer (or templates), then `RolePermission` rows. Assign users via `UserRole`.

## Migration

After pulling this schema:

```bash
npx prisma migrate dev --name add_rbac_models
```
