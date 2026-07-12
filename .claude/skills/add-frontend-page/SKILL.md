---
name: add-frontend-page
description: >-
  Add a new page in RTO-Super-Admin wired to TanStack Query and a service module, with an optional
  form and the shared DataTable. Use when the user says "add a frontend page/screen for X", "build the
  Y view", or wants a new routed screen consuming the backend API.
---

# Add a frontend page (RTO-Super-Admin)

Deterministic checklist. For larger features or judgment-heavy composition, delegate to the `frontend-feature-builder` agent.

## 0. Read first
- `RTO-Super-Admin/CLAUDE.md` and `docs/FRONTEND_INTEGRATION.md`.
- Templates: `src/pages/Dealers.jsx`, `src/services/dealerService.js`, `src/components/forms/DealerForm.jsx`, `src/components/tables/DataTable.jsx`.
- Confirm the backend endpoint exists in `EDEALER_RECORD/docs/api/API.md`. If not, the backend slice is a prerequisite.

## 1. Service — `src/services/<x>Service.js`
- `import api from '@/services/api'`. Expose `getAll/getById/create/update/delete`. Use `unwrap()` and `normalizePaginatedResponse()` from `@/lib/pagination`. Export `getXId(entity)`.

## 2. Page — `src/pages/<X>.jsx`
- `useQuery({ queryKey: ['resource', page, pageSize], queryFn })` for reads.
- `useMutation` for writes: `onSuccess` → `queryClient.invalidateQueries({ queryKey: ['resource'] })` + success `toast`; `onError` → `toast({ variant: 'destructive', description: getErrorMessage(err) })`.
- Use `PAGE_SIZE` from `@/lib/pagination` and render lists with `DataTable` (`mode="server"`, passing `page/totalPages/total/onPageChange`).

## 3. Form (if it creates/edits) — `src/components/forms/<X>Form.jsx`
- `react-hook-form` + `zodResolver`. **Export** the Zod `schema` and `defaultValues`. Map server field errors with `parseValidationErrors` → `setError`. Reuse the `Field` label/error pattern.

## 4. Route + nav
- Add the `<Route>` in `src/App.jsx` inside the `ProtectedRoute`/`DashboardLayout` group.
- If it's a primary nav item, add an entry to `NAV_ITEMS` in `src/lib/constants.js` (label, path, lucide `icon` name).

## 5. Styling
- Only shadcn `components/ui/` primitives; **no hardcoded colors** — `@theme` tokens (`bg-primary`, `text-muted-foreground`, `bg-card`, `border-border`) and `STATUS_COLORS`. Merge with `cn()`.

## 6. Role-gating
- If the page is dealer/agent-specific, follow the role-gating plan in `docs/FRONTEND_INTEGRATION.md` and flag that gating is being added (it doesn't exist yet).

## 7. Lint + report
- `npm run lint` (in `RTO-Super-Admin`). Report files added, query keys, and endpoints consumed. Do not commit unless asked.
