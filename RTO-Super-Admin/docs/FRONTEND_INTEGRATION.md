# Frontend Integration Guide

How the app talks to the backend, how server state is managed, which services are still mock, and how role-gated dealer/agent views will be added. Backend contract is in [`../../EDEALER_RECORD/docs/api/API.md`](../../EDEALER_RECORD/docs/api/API.md) and [`API_CONVENTIONS.md`](../../EDEALER_RECORD/docs/API_CONVENTIONS.md).

## The axios instance ([`src/services/api.js`](../src/services/api.js))

- Base URL `import.meta.env.VITE_API_BASE_URL` (falls back to a LAN `…:4002/api/v1`). Set this in `.env`.
- **Request interceptor** attaches `Authorization: Bearer <token>` from `localStorage`/`sessionStorage` (keys `TOKEN_KEY`/`REFRESH_TOKEN_KEY` from `@/lib/constants`).
- **Response interceptor** handles `401` by calling `/auth/refresh` once, retrying the original request, and on failure clearing tokens + redirecting to `/login`. Auth public paths (login, forgot/verify/reset/resend) skip the refresh dance.
- A `403` with app code `4022` (the super admin paused the caller's firm) from **any** guarded endpoint — the interceptor's refresh call included — force-signs the user out via [`src/lib/accessPaused.js`](../src/lib/accessPaused.js): the stored session is wiped and `AuthContext` raises the app-wide "Access paused" popup. The popup has a single OK button (no close icon, Escape/outside click ignored); the page the user was on stays behind it (requests through the shared `api` instance are held back meanwhile) and the redirect to `/login` happens only on OK. It is layered above every other overlay (`z-[70]`). A `4022` from a public sign-in path (`/auth/login`, `/auth/verify-otp`) raises the same popup but leaves the stored session alone — it is about the submitted credentials, not whoever is signed in in this browser. A signed-in dealer/agent tab also polls `GET /auth/me` every ~20s so an idle page is signed out too.
- Import it as `import api from '@/services/api'` in every service.

## Anatomy of a service module

Mirror [`src/services/dealerService.js`](../src/services/dealerService.js):

```js
import api from '@/services/api'
import { normalizePaginatedResponse } from '@/lib/pagination'

function unwrap(response) {            // backend envelope is { statusCode, message, data }
  return response?.data?.data ?? response?.data ?? response
}
function normalizeListResponse(data) { // tolerant of {data:{data,meta}} or bare arrays
  const n = normalizePaginatedResponse(data, 'widgets', 10)
  return { widgets: n.items, page: n.page, limit: n.limit, total: n.total, totalPages: n.totalPages }
}
export function getWidgetId(w) { return w?.id ?? w?._id ?? w?.widgetId }

export const widgetService = {
  async getAll({ page = 1, limit = 10 } = {}) {
    const { data } = await api.get('/widgets', { params: { page, limit } })
    return normalizeListResponse(data)
  },
  async getById(id) { const { data } = await api.get(`/widgets/${id}`); return unwrap(data) },
  async create(p) { const { data } = await api.post('/widgets', p); return unwrap(data) },
  async update(id, p) { const { data } = await api.patch(`/widgets/${id}`, p); return unwrap(data) },
  async delete(id) { const { data } = await api.delete(`/widgets/${id}`); return unwrap(data) },
}
```

Why the helpers: the backend wraps payloads in `data`, and lists in `data.data` + `data.meta`. `unwrap`/`normalizePaginatedResponse` make services resilient to both shapes so pages stay simple. `getXId` exists because records may key on `id`, `_id`, or `<entity>Id`.

## React Query conventions

- **Query keys:** `['resource', ...params]`, e.g. `['dealers', page, pageSize]`. Invalidate with the **prefix** key (`['dealers']`) after a mutation.
- Defaults (set in `App.jsx`): `staleTime` 5 min, `retry` 1, no refetch on focus.
- **Mutations:** `onSuccess` → `invalidateQueries({ queryKey: ['resource'] })` + success `toast`; `onError` → destructive `toast` with `getErrorMessage(err)`. Map field errors in the **form** via `parseValidationErrors`.
- Page sizes: `PAGE_SIZE.client` (8), `PAGE_SIZE.crud` (10), `PAGE_SIZE.location` (50) from `@/lib/pagination`.

## Mock → live migration map

These services currently return data from `src/data/mockData.js`. Migrate each with the `connect-mock-to-live-api` skill once the backend endpoint exists; **keep the existing return shape** so pages don't change.

| Mock service | Becomes live against | Backend status |
|---|---|---|
| `dealerService` | `/dealers` (CRUD) | ✅ already live |
| `stateService` / `cityService` | `/states`, `/cities` | ✅ already live |
| `authService` | `/auth/*` | ✅ already live |
| `userService` | `/dealer-wise-users`, `/users` (RBAC user mgmt) | 🟡 partial — confirm endpoints in API.md |
| `dashboardService` | a stats endpoint (not built) | ❌ backend work first |
| `requestService` | subscription/approval endpoints | ❌ net-new (ROADMAP item 2) |
| `notificationService` | notifications endpoints | ❌ net-new (ROADMAP item 6) |

Before migrating a service, **verify the endpoint exists in `API.md`**; if not, the backend slice is a prerequisite (use the backend tooling first).

## Role-gating plan (dealer / agent views — not built yet)

The product will serve super-admin, dealer, and agent from this one app. Today there is **no role gating**: `USER_ROLES` (`super_admin`/`dealer`/`agent`) is defined in `@/lib/constants`, but `ProtectedRoute` only checks authentication and `NAV_ITEMS` is a flat super-admin list. When implementing:

1. Store the logged-in user's role (from the auth/login response) in `AuthContext`.
2. Make `ProtectedRoute` accept an allowed-roles prop and redirect unauthorized roles to their landing page.
3. Filter `NAV_ITEMS` by role (or keep per-role nav arrays).
4. Add dealer and agent route groups + pages, each consuming the matching backend slice.
5. Align frontend role strings with the backend's `RoleType`/RBAC (`DEALER`/`AGENT`) — decide the mapping when wiring auth.

This is a backlog item; see [`../../EDEALER_RECORD/docs/ROADMAP.md`](../../EDEALER_RECORD/docs/ROADMAP.md).
