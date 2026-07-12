# Roadmap / Backlog — what's built vs. net-new

**Read this first when given a new feature requirement.** It tells you whether the data model already supports the ask or whether it's net-new, which layers/files are affected, and what it depends on. Built features are documented in [DATA_MODEL.md](DATA_MODEL.md); terms are in [DOMAIN_GLOSSARY.md](DOMAIN_GLOSSARY.md).

## Status legend

✅ built · 🟡 partial (scaffold/flag exists, logic missing) · ❌ net-new (no model/code yet)

## Already built (don't rebuild)

- ✅ **Auth** — register + email-OTP verify, login, forgot/reset password, WebAuthn passkeys.
- ✅ **Multi-tenant dealers** — `Dealer` CRUD, `DealerWiseUser` (user↔dealer 1:1), per-dealer statuses / references / upload categories.
- ✅ **Vehicles & processes** — `Vehicle`, `VehicleProcess` with persons, references, upload images/photos, tasks.
- ✅ **Documents & OCR (partial)** — categorized uploads + Gemini extraction service.
- ✅ **RBAC framework** — Module/Page/PageAction/Role/RolePermission/UserRole, `RoleType DEALER|AGENT`, default-deny, sync endpoints.
- ✅ **Master data** — states, cities, RTO services, upload categories.
- ✅ **Super-Admin frontend** — dashboard, dealers, users, requests, subscriptions, state/city, settings (some screens still on mock data — see frontend `FRONTEND_INTEGRATION.md`).

---

## Backlog (sequenced by business value × dependency)

### 1. 🟡 OCR field → Vehicle mapping (finish the partial)
- **Today:** `ai.service.ts` (Gemini) extracts fields from RC/ID photos via `/ai/*`, but the extracted values aren't consistently written onto `Vehicle`/`VehicleProcess`.
- **Work:** define the extraction→field contract (registrationNumber, registrationDate, make, model, chassisNumber, engineNumber, owner name/address), wire it into the process-creation flow, let the user verify before save.
- **Layers:** `ai.service`, `vehicle-process.service`, `vehicle.repository`; frontend "create process" form.
- **Depends on:** nothing. Good first enhancement.

### 2. ❌ Subscription + approval workflow
- **Today:** only `Dealer.isSubscribe` boolean; the super-admin Subscriptions/Requests screens are **mock**.
- **Work:** add `SubscriptionPlan` (limits: vehicles/employees/agents) and `Subscription` (party, plan, status `PENDING|ACTIVE|EXPIRED|REJECTED`, dates). Sign-up creates a pending request → super admin approves → access granted. Both dealers and agents subscribe.
- **Layers:** new models + migration; repository/service/controller/routes slice; RBAC pages; frontend Requests/Subscriptions move mock→live.
- **Depends on:** an explicit Agent identity (item 4) for agent subscriptions.

### 3. ✅ Ledger / Khata book (dealer ↔ agent)  *(Phase 5 — BUILT)*
- **Built:** `KhataAccount` (one per real-dealer↔agent pair, cached `balance`/`totalCredit`/`totalDebit`) + immutable `LedgerEntry` (`LedgerDirection CREDIT|DEBIT`, `amount`, `balanceAfter` per-row running-balance snapshot, `seq` ordering, `assignmentId` hook, reversal via `reversesEntryId`). Money is `Decimal(14,2)`; posts are atomic (`increment` UPDATE, no read-then-write race). The `khata` slice (`/khata/accounts`, `/accounts/:id/statement`, `/entries`, `/entries/:id/reverse`, `/accounts/:id/settle`) is **dual-persona** — both the dealer and the agent post credit/debit and view the mirrored book; every write asserts a live `ACTIVE` `DealerAgent` grant (`4054`); a placeholder dealer must be connected first (`4057`). Frontend: one shared `Ledger.jsx` at `/dealer/ledger` + `/agent/ledger`. Never hard-deletes (reverse-by-counter-entry). New error codes `4054`–`4059`.
- **Deferred:** per-service pricing + auto-post on assignment completion (the `assignmentId` FK + `KHATA_AUTO_POST_ON_COMPLETE` flag are the seam), real payment gateway, back-dated entries, exports.

### 4. ✅ Agent identity + Agent↔Dealer↔Process assignment + agent app  *(Phase 4 — BUILT)*
- **Decision (settled):** Agent is a **first-class entity** (`Agent`, mirroring `Dealer`), with `AgentWiseUser` (user→agent login persona), a `DealerAgent` grant (M:N, `DEALER_GRANT`/`CONNECT`), `AgentStatus` (per-agent kanban), and `ProcessAssignment` (dealer assigns a process + `RtoService` to an agent). Placeholder dealers = `Dealer` rows with `isPlaceholder`/`ownerAgentId`/`connectedDealerId`.
- **Built:** the full operational loop — super admin creates agents + owner users (`POST /agents`, `POST /agents/with-user`); a dealer grants agents (`/dealer-agents`, cap-aware) and assigns processes (`/process-assignments`); the agent logs in (token carries `agentId`), sees dealer-wise assignments, and updates RTO status; agents manage placeholder dealers and connect them to real dealers (`/placeholder-dealers`). Frontend: super-admin Agents page, dealer `DealerAgents` + assign control, and the agent app `/agent/*`.
- **Deferred (commercial layer):** payments, super-admin subscription-config UI, hard cap + pay-per-extra enforcement, fine-grained AGENT RBAC. See **[SUBSCRIPTION_ACCESS_MODEL.md](SUBSCRIPTION_ACCESS_MODEL.md)** for the full two-sided subscription/access rules and exactly what is deferred.

### 5. ✅ Vehicle transaction history (first-class) — BUILT (Phase 6)
- **Decision:** **derived from process**, no new table — added `purchasePrice` / `salePrice` / `priceCurrency` + `@@index([vehicleId])` to `VehicleProcess`; the history is a read-side aggregation.
- **Backend:** `GET /vehicles/history?registrationNumber=` — dealer-scoped; resolves the vehicle by normalized reg number, requires the caller to own ≥1 process (else 404 `4047`, not a cross-dealer oracle). Returns own `events[]` (BUY iff a SELLER, SELL iff a BUYER; amount `null` when a price isn't recorded), an own `summary` (gross margin via Decimal math), and an **anonymized** `market` signal (changed-hands count / dealerships / year range — no price/PII/dealer identity). Prices captured on `start` + `PATCH /vehicle-processes` (invariants: ≤1 seller/buyer; price requires its counterparty).
- **Frontend:** price inputs in the create wizard, an editable **Deal** card on the process detail (`DealPricePanel` — set/clear prices post-sale), and a **Vehicle History** page (`/dealer/vehicle-history`).
- **Deferred:** standalone pre-platform deals with no process (would need the dedicated `VehicleTransaction` table); opt-in cross-dealer market history; multi-currency; netting margin against khata/RTO costs (gross only in v1).

### 6. 🟡 Supporting systems (per requirements doc, lower priority)
- ✅ **Expense tracking + profit calc — BUILT (Phase 7):** `ProcessExpense` (dealer-scoped child of `VehicleProcess`, cascade delete) + `/process-expenses` CRUD slice; net profit = `salePrice − purchasePrice − Σ(amount)` surfaced on the process **Deal** card + itemized **Expenses** panel, and aggregated in `GET /vehicles/history` (`summary.expenseTotal` / `summary.netProfitTotal`).
- ❌ Still open: task **subtasks**, tags, priority; activity timeline; notifications; audit logs; marketplace listings.

---

## Frontend direction (decided)

**Dealer-facing and Agent-facing UIs extend the existing `RTO-Super-Admin` app via role-gated routes** — one app serves super-admin, dealer, and agent based on the logged-in role. There is **no role-based UI gating today**; adding it (role-aware `ProtectedRoute`, role-filtered `NAV_ITEMS`, role-scoped landing) is its own backlog item and a prerequisite for shipping dealer/agent screens. Details in [`../../RTO-Super-Admin/docs/FRONTEND_INTEGRATION.md`](../../RTO-Super-Admin/docs/FRONTEND_INTEGRATION.md).

## Open decisions to confirm before building

- ~~**Agent entity** (item 4): dedicated `Agent` table vs. `RoleType.AGENT` tenant.~~ **RESOLVED** → first-class `Agent` table (Phase 4 built). See [SUBSCRIPTION_ACCESS_MODEL.md](SUBSCRIPTION_ACCESS_MODEL.md).
- **Vehicle history** (item 5): reuse `VehicleProcess` vs. dedicated transaction table.
- **Payments**: subscriptions (item 2) — manual super-admin approval only, or a payment gateway (Razorpay/Stripe)? No gateway is integrated today.
