---
name: update-api-docs
description: >-
  Update the API reference (docs/api/API.md) and the Postman collection in EDEALER_RECORD after
  creating or changing an endpoint, keeping them in parity with the route. Use when the user says
  "update API docs", "update Postman", or after any backend endpoint change (it's part of the
  definition of done).
---

# Update API docs + Postman (EDEALER_RECORD)

Every new/changed endpoint must be reflected in both `docs/api/API.md` and `docs/postman/EDealer-API.postman_collection.json`. This skill keeps them in sync with the code.

## 1. Identify the endpoints
- From the route file(s) and `src/routes/index.ts`, list each affected endpoint: method, full path (with `/api/v1` prefix), auth requirement, request body/params/query (from the Zod schema), success shape, and the app error codes it can throw.

## 2. Read the existing formats
- Open `docs/api/API.md` (note the section/table style: a method+path heading, request body table with validation rules, success JSON, an **Errors:** line listing app codes).
- Open `docs/postman/EDealer-API.postman_collection.json` (note the folder-per-route-group structure and how requests set method, URL with `{{baseUrl}}`, headers, and raw JSON body).

## 3. Update API.md
- For each endpoint, add/edit an entry under the right route-group section with: method + path; **Auth** (none / Bearer required); request body schema (field, type, required, validation), path/query params; success response (status + `data` shape) with example JSON; the application error codes it returns (cross-reference `docs/API_CONVENTIONS.md`).

## 4. Update the Postman collection
- Add/edit the request in the matching folder (create the folder if the route group is new): method, full path using `{{baseUrl}}/api/v1/...`, headers (`Content-Type: application/json`, and `Authorization: Bearer {{token}}` when auth is required), and a valid raw JSON body example (use Postman variables like `{{dealerId}}` where helpful).

## 5. Verify parity
- Confirm the route file, API.md, and Postman all agree on method, path, auth, and body. Note any discrepancy you fixed.

## 6. Report
List the endpoints documented and the files touched. Do not commit unless asked.
