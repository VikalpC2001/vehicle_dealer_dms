# RTO-Super-Admin — Frontend Rulebook

React 19 + Vite single-page app for the RTO platform. **Today it is the Super-Admin panel**; dealer- and agent-facing views will be added here as role-gated routes (see [docs/FRONTEND_INTEGRATION.md](docs/FRONTEND_INTEGRATION.md)).

> ⚠️ Ignore `EDEALER_RECORD/.cursor/rules/frontend-ui.mdc` — it describes **Next.js + Material UI**, which this project does **not** use.

> Companion docs: [docs/COMPONENT_GUIDE.md](docs/COMPONENT_GUIDE.md) (authoring UI components + atomic design) · [docs/FRONTEND_INTEGRATION.md](docs/FRONTEND_INTEGRATION.md) (services, React Query, mock→live, role-gating). Canonical design tokens & patterns live in [`Global Design System.md`](Global%20Design%20System.md) — **do not duplicate it; reference it.**

## Stack

- **React 19 + Vite**, **JavaScript / JSX (no TypeScript)**.
- **Tailwind CSS v4** with `@theme` design tokens in [`src/index.css`](src/index.css) (not a `tailwind.config.js`).
- **shadcn/ui installed manually** (Radix primitives + CVA) — **no `components.json`, no shadcn CLI**. Primitives live in [`src/components/ui/`](src/components/ui/).
- **TanStack React Query** for server state; **React Context** (`Auth`, `Theme`, `PasswordReset`) for client state.
- **react-router-dom v7**; **react-hook-form + Zod** (`@hookform/resolvers/zod`); **Axios**; **Framer Motion**; **Recharts**; **lucide-react**; **Storybook v10**.
- Path alias **`@/` → `src/`**.

## Run

```bash
npm install
cp .env.example .env        # set VITE_API_BASE_URL (default points at the backend /api/v1)
npm run dev                 # vite --host → http://localhost:5173
npm run storybook           # design-system explorer → :6006
npm run lint
```

## Folder structure (feature-domain)

```
src/
  components/
    ui/          shadcn primitives (Button, Input, Card, Badge, Dialog, Table, Toast…)
    common/      StatusBadge, SearchInput, EmptyState, PageTransition, ProtectedRoute
    layout/      DashboardLayout, Sidebar, Topbar, AuthLayout
    forms/       *Form.jsx (rhf + co-located Zod schema + defaultValues)
    tables/      DataTable (client/server pagination) + helpers
    charts/      Recharts wrappers
    modals/      ConfirmModal
    dashboard/ dealers/ locations/   domain-specific composites
  pages/         one file per route (PascalCase)
  context/       AuthContext, ThemeContext, PasswordResetContext
  hooks/         useDebounce, use-toast
  services/      <x>Service.js (axios via @/services/api)
  lib/           utils.js (cn, formatters, downloadCSV), constants.js, pagination.js, authErrors.js
  data/          mockData.js
  stories/       Storybook stories mirroring components
```

The tree is organized by feature-domain, **not** atomic folders. New **shared/UI** components follow an atomic-design *taxonomy* (see COMPONENT_GUIDE) without renaming the existing tree.

## Data-flow contract (page → query → service → API)

The canonical example is [`src/pages/Dealers.jsx`](src/pages/Dealers.jsx) + [`src/services/dealerService.js`](src/services/dealerService.js) + [`src/components/forms/DealerForm.jsx`](src/components/forms/DealerForm.jsx). **Read these before building a page.** Pattern:

1. **Service** (`services/<x>Service.js`): import the shared axios instance `@/services/api`; expose `getAll/getById/create/update/delete`. Normalize reads with `unwrap()` and `normalizePaginatedResponse()` (from `@/lib/pagination`); export a `getXId(entity)` id resolver.
2. **Page** (`pages/<X>.jsx`): `useQuery({ queryKey: ['resource', page, pageSize], queryFn })` for reads; `useMutation` for writes with `onSuccess` → `queryClient.invalidateQueries({ queryKey: ['resource'] })` + a success `toast`, and `onError` → `toast({ variant: 'destructive', description: getErrorMessage(err) })`. Page sizes come from `PAGE_SIZE` in `@/lib/pagination`.
3. **List UI:** use the existing `DataTable` (`mode="server"` with `page/totalPages/total/onPageChange`).
4. **Toasts** via `import { toast } from '@/hooks/use-toast'`.

## Forms

- `react-hook-form` + `zodResolver`. **Co-locate and export** the Zod `schema` and `defaultValues` from the form component (`components/forms/<X>Form.jsx`), as `DealerForm.jsx` does.
- Surface server-side field errors with `parseValidationErrors(err)` (from `@/lib/authErrors`) → `setError(field, { message })`. Generic errors via `getErrorMessage(err)`.

## Styling & design system

- **Use shadcn primitives** from `components/ui/`. Build variants with **CVA** + `cn()` (`@/lib/utils`).
- **Never hardcode colors.** Use `@theme` tokens as Tailwind classes: `bg-primary`, `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`, `bg-destructive`, `text-success`, `bg-warning`, plus utilities `gradient-bg`, `gradient-text`, `glass-card`. Status pills use the `STATUS_COLORS` map in `@/lib/constants`.
- **Dark mode** is driven by a `.dark` class on `<html>` (via `ThemeContext`); tokens swap automatically — don't write `dark:` overrides for colors that are already tokenized.
- Font is **Inter**; radii are tokenized (`rounded-md/lg/xl`). Primary brand color `#2563EB`.

## Service status (live vs mock) — state which you target

- **Live (real API):** `authService`, `dealerService`, `stateService`, `cityService`.
- **Mock (`src/data/mockData.js`):** `userService`, `dashboardService`, `requestService`, `notificationService`. Migrate these with the `connect-mock-to-live-api` skill once the backend endpoints exist.

## Storybook & accessibility

- Every new **shared/ui** component gets a Storybook story under `src/stories/` mirroring its folder, and proper a11y (labels, `aria-*`, focus rings) as the existing primitives do.

## Role-gating (coming — not built yet)

There is **no role-based UI gating today** (`USER_ROLES` exists in constants but `ProtectedRoute` only checks auth, and all routes are super-admin). When dealer/agent views land, gating will be added via a role-aware `ProtectedRoute`, role-filtered `NAV_ITEMS`, and role-scoped landing pages. Don't assume role gating exists; add it deliberately. See FRONTEND_INTEGRATION.md and the backend ROADMAP.

## Conventions

- Components `PascalCase`; hooks `use*`; services `*Service`; import via `@/`.
- CSV export via `downloadCSV`; dates/currency via the `lib/utils` formatters (`en-IN`).
- Keep pages thin: data fetching in the page, presentation in components, validation in the form's Zod schema.
