# Subscription & Access Model (Dealer ↔ Agent)

> **Status:** the *data model* and the *operational agent loop* are built (Phase 4). The *commercial layer* (payments, super-admin subscription config, hard cap enforcement) is **deferred** — see "Deferred / not yet enforced" at the bottom. This document is the source of truth for how the two-sided model is intended to work, so future work doesn't contradict it.

## The two parties

There are **two separate first-class entities**, each with its own app surface and its own login:

| Entity | Table | Site / role | Created by |
|--------|-------|-------------|------------|
| **Dealer** (firm) | `Dealer` | Dealer dashboard (`/dealer/*`), role `dealer` | Super admin (`POST /agents`… no — `POST /dealers`) |
| **Agent** | `Agent` | Agent dashboard (`/agent/*`), role `agent` | Super admin (`POST /agents`) |

A platform **user** logs in once and is routed to the right site by which link table they belong to:
- `DealerWiseUser` (user → dealer) ⇒ token carries `dealerId` ⇒ role `dealer`.
- `AgentWiseUser` (user → agent) ⇒ token carries `agentId` ⇒ role `agent`.
- Neither ⇒ `super_admin`.

A user is in **at most one** of those tables (both enforce `userId @unique`; the `agent-wise-user` create path also rejects an email/user already linked to a dealer — cross-persona guard, code `4097`). Frontend role = `agentId ? 'agent' : dealerId ? 'dealer' : 'super_admin'`.

> A **placeholder dealer** (below) has **no `DealerWiseUser` and no login user**, so it can never produce a dealer session. That is how "a placeholder gets no dealer site" is enforced — at auth, not in the data.

## Super admin sells subscriptions to BOTH

The super admin onboards and subscribes dealers **and** agents (`Dealer.isSubscribe`, `Agent.isSubscribe`). Each subscription unlocks a different capability set.

### A) Dealer buys a subscription
- Gets the **dealer site**.
- Can grant **agent-site access to up to `Dealer.maxAgents` agents** (default `2`, super-admin-configurable per dealer later). Each grant is a `DealerAgent` row with `source = DEALER_GRANT`.
- Those agents work the agent site **scoped to that dealer** — they only see the processes that dealer assigned them.
- Beyond `maxAgents`, the dealer **pays per extra agent** (billing deferred).
- The dealer assigns a `VehicleProcess` + a chosen `RtoService` to a granted agent (`ProcessAssignment`); the agent works it through the agent's own kanban statuses (`AgentStatus`), and the dealer sees the agent's current status on the process.

### B) Agent buys a subscription
- Gets the **agent site**.
- Can add **placeholder dealers** = name-only containers to organize work. A placeholder is a `Dealer` row with `isPlaceholder = true`, `ownerAgentId = <agent>`, and **null contact fields** (it is not a real account — no login, no dealer dashboard).
- The agent assigns/works processes under those placeholder dealer names exactly like a real dealer's, because a placeholder flows through the same `VehicleProcess.dealerId` and assignment/status code paths.

### C) Connect (both parties subscribed)
- When **both** a real subscribed dealer and the agent are subscribed, the agent can **connect a placeholder → the real dealer** (`POST /placeholder-dealers/:id/connect`, requires the target to be `isPlaceholder = false` **and** `isSubscribe = true`, else `4098`).
- Connecting sets `placeholder.connectedDealerId` and creates/reactivates a `DealerAgent` grant with **`source = CONNECT`**.
- **Cap interaction:** the dealer's `maxAgents` cap counts **only `ACTIVE` grants with `source = DEALER_GRANT`**. `CONNECT` grants are **excluded** from the cap — so a connected relationship does **not** consume one of the dealer's standard agent slots.
- Disconnect (`/disconnect`) clears `connectedDealerId` and revokes the `CONNECT` grant.

## Data model (built)

| Model | Purpose | Key fields |
|-------|---------|------------|
| `Agent` | First-class agent entity (mirrors `Dealer`) | `agentId`, firm/agent/display name, optional contact, `isSubscribe` |
| `AgentWiseUser` | user → agent link (login persona) | `userId @unique`, `agentId` |
| `Dealer` (extended) | also represents placeholders | `isPlaceholder`, `ownerAgentId`, `connectedDealerId`, **`maxAgents`** (default 2); contact fields now nullable (kept `@unique` — Postgres allows multiple NULLs) |
| `DealerAgent` | dealer↔agent grant (the M:N) | `dealerId`, `agentId`, `status` (`ACTIVE`/`REVOKED`), `source` (`DEALER_GRANT`/`CONNECT`), `@@unique([dealerId, agentId])` |
| `AgentStatus` | per-agent RTO kanban statuses (agent board columns) | seeded on agent create: To-Do, In Progress, Inward, Pending, Query, Complete |
| `ProcessAssignment` | dealer assigns process+service to agent | `processId`, `dealerId` (denormalized), `agentId`, `serviceId`, `agentStatusId`, `status` (`OPEN`/`COMPLETED`/`CANCELLED`), `@@unique([processId, agentId, serviceId])` |

The cap is computed as `count(DealerAgent where dealerId, status=ACTIVE, source=DEALER_GRANT)` and returned as `capInfo { maxAgents, used, overCap }` on `GET/POST /dealer-agents`.

## Deferred / not yet enforced (intentional)

These are designed-for but **not built**; do not assume they exist:

- **Payments / billing** — no gateway. Subscriptions are toggled by `isSubscribe` (set in DB/by super admin), not purchased.
- **Super-admin subscription config UI** — `Dealer.maxAgents` and `isSubscribe` are set directly (DB/seed/API), not via a screen yet.
- **Hard cap enforcement & pay-per-extra-agent** — the cap is **counted and surfaced** (`overCap: true`) but grants are **not blocked** beyond `maxAgents`. Billing for extra agents is future work.
- **`Subscription` / `SubscriptionPlan` models + approval workflow** — see `ROADMAP.md` item 2.
- **Ledger / Khata** (`/dealer/ledger`, `/agent/ledger`) — stubbed; `ProcessAssignment.assignmentId` is the natural future FK from a `LedgerEntry`.
- **Fine-grained AGENT RBAC** — the agent app is gated by the `agent` role (from `agentId`); the RBAC `AGENT` catalog/permission rows are not seeded yet (no runtime RBAC enforcement exists for dealers either today).

## Related

- API endpoints: `docs/api/API.md` (Agents, Agent-wise-users, Agent-statuses, Dealer-agents, Process-assignments, Placeholder-dealers).
- New error codes: `docs/API_CONVENTIONS.md` (`4035`–`4037` agent-scope, `4044` agent-not-found, `4097` cross-persona, `4098` bad-connect, `4228` grant-required, `4229` invalid-status-for-agent).
- Backlog & sequencing: `docs/ROADMAP.md` items 2–4.
