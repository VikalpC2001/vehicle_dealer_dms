# Domain Glossary — RTO Dealer/Agent Platform

The ubiquitous language for this codebase. When a requirement uses one of these words, map it to the entity here. Model details are in [DATA_MODEL.md](DATA_MODEL.md); the sequenced backlog of unbuilt concepts is in [ROADMAP.md](ROADMAP.md).

## Actors

| Term | Meaning |
|------|---------|
| **Super Admin** | Platform operator. Approves dealer/agent sign-ups and subscriptions, manages master data. Served today by the `RTO-Super-Admin` frontend. No dedicated DB model — represented via the legacy `Role.ADMIN` JWT claim / future RBAC. |
| **Dealer** | A second-hand vehicle dealership (firm). The primary tenant. Owns vehicles, processes, statuses, references, upload categories, and users. Model: `Dealer`. |
| **Agent** | An RTO agent who performs government RTO services (name transfer, etc.) on a dealer's behalf. **One agent serves many dealers.** Agents can create dealers; dealers cannot create agents. Represented via `RoleType.AGENT` (no dedicated `Agent` table yet — see ROADMAP). |
| **User** | A login identity (`User` model). Linked to exactly one dealer via `DealerWiseUser`. Can be assigned RBAC roles (`UserRole`) and process tasks. |

## Vehicle & process

| Term | Meaning | Model |
|------|---------|-------|
| **Vehicle** | A physical vehicle, keyed by unique `registrationNumber` (also unique `chassisNumber`/`engineNumber`). Flat record reused across many transactions. | `Vehicle` |
| **Vehicle Process** | One buy/sell + RTO workflow instance for a vehicle under a dealer. The central transactional entity. Carries a free-text `status`, `processDate`, and links persons, references, uploads, photos, and tasks. **One vehicle can have many processes** (sold/bought many times → history). | `VehicleProcess` |
| **Person** | Buyer or seller details attached to a process (`personType` = `SELLER` \| `BUYER`): name, mobile, address. | `Person` |
| **RTO Service** | Master list of government services an agent performs (e.g. "Registration Transfer", "Ownership Change"). | `RtoService` |

## References & status (per-dealer customization)

| Term | Meaning | Model |
|------|---------|-------|
| **Dealer Reference** | A dealer-defined reference person/number (who introduced a buy or sell). | `DealerReference` |
| **Process Reference** | Links a process to a dealer reference, typed `BUY` or `SELL` (`ReferenceType`). | `ProcessReference` |

## Documents & uploads

| Term | Meaning | Model |
|------|---------|-------|
| **Upload Category** | Master document type for grouping uploads (e.g. RC, Insurance, PUC, Owner ID). `bothSide` flags front/back docs. | `UploadCategory` |
| **Dealer-Wise Upload Category** | Per-dealer configuration of an upload category: ordering, `isRequired`, `isProcess`, `isViewInStep`, optional `processApi`. | `DealerWiseUploadCategory` |
| **Process Upload Image** | An uploaded image file for a process, scoped to a dealer-wise upload category. Stores `imageLink`. | `ProcessUploadImage` |
| **Process Upload Photo** | A named photo entry for a process (category + display name; no URL). | `ProcessUploadPhoto` |
| **OCR extraction** | Gemini vision reads an RC/ID photo and returns vehicle/owner fields to auto-fill the form. Backed by `ai.service.ts`. The mapping of extracted fields onto `Vehicle`/process is only partially wired — see ROADMAP. |

## Tasks & assignment

| Term | Meaning | Model |
|------|---------|-------|
| **Process Task** | A to-do on a process (e.g. "make insurance", "make PUC"): `taskName`, `taskDate`, optional assignee `User`. | `ProcessTask` |
| **Dealer-Wise User** | Binds a `User` to exactly one `Dealer` (the user's tenant). `userId` is globally unique here. | `DealerWiseUser` |

## Auth & access

| Term | Meaning | Model |
|------|---------|-------|
| **Email OTP** | HMAC-hashed one-time code for signup email verification or password reset (`OtpPurpose`). | `EmailOtp` |
| **Passkey** | WebAuthn credential for passwordless login. | `Passkey` |
| **Module / Page / PageAction** | RBAC catalog: a navigable surface (Module) → screen (Page, unique `slug` per module) → action (VIEW/CREATE/UPDATE/DELETE/EXPORT). Scoped by `RoleType`. | `Module`, `Page`, `PageAction` |
| **Role / RolePermission / UserRole** | A tenant-scoped role, its grants on (page, action), and its assignment to users. **Default-deny.** | `Role`, `RolePermission`, `UserRole` |

## Enums

- **`PersonType`** — `SELLER`, `BUYER`
- **`ReferenceType`** — `BUY`, `SELL`
- **`RoleType`** — `DEALER`, `AGENT` (scopes app surface, modules, and roles)
- **`OtpPurpose`** — `SIGNUP_EMAIL_VERIFICATION`, `PASSWORD_RESET`
- **Legacy `Role`** (TS enum, not Prisma) — `ADMIN`, `USER` (JWT claim; being phased out — see backend CLAUDE.md)

## Not yet modeled (→ [ROADMAP.md](ROADMAP.md))

Subscription plans & approval workflow (only `Dealer.isSubscribe` boolean today) · **Ledger / Khata book** (dealer↔agent money) · vehicle transaction history as a first-class concept · explicit **Agent** entity & agent↔dealer↔process assignment · agent-side custom statuses · expense/profit tracking · marketplace listings · notifications · audit logs.
