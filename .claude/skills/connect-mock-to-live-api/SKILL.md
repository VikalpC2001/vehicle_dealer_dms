---
name: connect-mock-to-live-api
description: >-
  Convert a mock service in RTO-Super-Admin (userService, dashboardService, requestService,
  notificationService) to call the live backend API, preserving the existing return shape so pages
  don't break. Use when the user says "connect X service to the API", "make userService real", or
  "replace mock data with the backend".
---

# Connect a mock service to the live API (RTO-Super-Admin)

The app has live services (auth, dealer, state, city) and mock ones (`userService`, `dashboardService`, `requestService`, `notificationService`) backed by `src/data/mockData.js`. This skill migrates one mock service to the real API **without changing the shape the pages already consume**.

## 0. Read first
- `RTO-Super-Admin/docs/FRONTEND_INTEGRATION.md` (the mock→live map) and `src/services/dealerService.js` (the live template with `unwrap`/`normalizeListResponse`/`getXId`).

## 1. Capture the current contract
- Read the target mock service and every page that imports it. Note the **exact return shapes** of each method (e.g. `{ users, total, totalPages }`, a stats object, etc.). You must preserve these.

## 2. Confirm the backend endpoints exist
- Find the matching endpoints in `EDEALER_RECORD/docs/api/API.md`. **If they don't exist, stop** — the backend slice is a prerequisite; tell the user (and offer to build it with the backend tooling). Do not point the service at a non-existent route.

## 3. Rewrite the service against `@/services/api`
- Replace mock returns with `api.get/post/patch/delete` calls. Use `unwrap()` for single objects and `normalizePaginatedResponse()` for lists. **Adapt the response to the original return shape** the pages expect (map fields if the backend names differ).

## 4. Adjust query keys / errors if needed
- If field names changed, update the consuming pages' column accessors / form mappers minimally. Keep React Query keys stable unless params changed.

## 5. Clean up
- Remove the now-unused mock import from the service. Keep `mockData.js` only if other modules still reference it.

## 6. Smoke-test
- Run the page (or `npm run dev`) and confirm reads/writes work; check the network calls hit `/api/v1/...` and errors toast correctly via `getErrorMessage`.

## 7. Lint + report
- `npm run lint`. Report the service migrated, endpoints used, any field mapping applied, and pages touched. Do not commit unless asked.
