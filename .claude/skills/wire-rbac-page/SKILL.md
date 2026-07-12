---
name: wire-rbac-page
description: >-
  Register a module/page/action in the RBAC catalog and grant role permissions in EDEALER_RECORD
  (Module → Page → PageAction → RolePermission → UserRole, default-deny). Use when the user says "wire
  RBAC for a page", "add a module/page/action", "grant permissions for X", or "set up DEALER/AGENT
  access".
---

# Wire RBAC for a page/action (EDEALER_RECORD)

Deterministic checklist. For ambiguous design or access debugging, delegate to the `rbac-specialist` agent.

## 0. Read first
- `EDEALER_RECORD/docs/DATA_MODEL.md` (RBAC section), `docs/database/RBAC.md`, and `src/services/rbac-navigation.service.ts` for sync semantics.

## 1. Choose the surface
- Decide `moduleType`: **`DEALER`** or **`AGENT`** (the app surface this page belongs to).

## 2. Sync the Module
- Ensure the `Module` exists for that `moduleType` (sync the modules array — module name unique per type, else `4092`). `sortOrder` follows array order.

## 3. Sync the Page
- Add the `Page` under the module. **`slug` is unique per module** (`@@unique([moduleId, slug])`; duplicate → `4093`). Set `pageName`, `slug`, `sortOrder`.

## 4. Sync the Page Actions
- Add `PageAction`s with stable keys: `VIEW`, `CREATE`, `UPDATE`, `DELETE`, `EXPORT` (only those the page needs). Action name unique per page (duplicate → `4094`).

## 5. Grant permissions (remember default-deny)
- Create `RolePermission` rows for each role that needs each action — **a missing row means deny**, so every required (role, page, action) needs an explicit row. Use `isAllowed: false` only for an explicit deny.

## 6. Assign roles to users
- Note/ensure the `UserRole` assignments so real users actually receive the role.

## 7. Verify
- Fetch the catalog (`getCatalog(moduleType)` via the `/rbac` routes) and confirm the module → page → action tree and the grants. For an access bug, trace: token → `UserRole` → `RolePermission(pageId, actionId)` and find the first missing link.

## 8. Report
Summarize the catalog rows and permissions created and how to verify. Do not commit unless asked.
