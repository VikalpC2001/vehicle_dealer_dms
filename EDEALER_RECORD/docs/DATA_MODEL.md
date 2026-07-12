# Data Model Reference

Distilled from [`prisma/schema.prisma`](../prisma/schema.prisma). Glossary in [DOMAIN_GLOSSARY.md](DOMAIN_GLOSSARY.md). **The schema is the source of truth** — when in doubt, read it. Regenerate this doc when models change (the `add-prisma-model` skill reminds you).

## Conventions (all models)

- **PKs:** UUID `@default(dbgenerated("gen_random_uuid()")) @db.Uuid`.
- **Tables/columns:** model `PascalCase` + `@@map("snake_case")`; field `camelCase` + `@map("snake_case")`.
- **Timestamps:** `@db.Timestamp(6)`. ⚠️ **Inconsistency:** most models use `createdAt`/`updatedAt`, but `State`, `City`, and `User` use `creationDate`/`modificationDate`. Match the model you're editing.
- **Enums:** `PersonType(SELLER,BUYER)`, `ReferenceType(BUY,SELL)`, `RoleType(DEALER,AGENT)`, `OtpPurpose(SIGNUP_EMAIL_VERIFICATION,PASSWORD_RESET)`.

## Tenancy rules

Dealer-scoped models carry a `dealerId` and **must be filtered by it** in queries (resolve via `resolveDealerIdFromRequest`): `DealerStatus`, `DealerReference`, `DealerWiseUploadCategory`, `DealerWiseUser`, `VehicleProcess`, `ProcessReference`. ⚠️ `dealerId` is **nullable** on `DealerReference`, `VehicleProcess`, and `ProcessReference` (legacy rows) — handle nulls and use `assertDealerMatchesToken` when reading by id. `Vehicle` is **global** (shared across dealers via its unique `registrationNumber`); a vehicle's dealer association is through its `VehicleProcess` rows.

---

## States & Cities

- **`State`** (`state_data`) — `stateId` PK · `stateName` unique · → `cities City[]`.
- **`City`** (`city_data`) — `cityId` PK · `stateId` FK→State (cascade) · `cityName` · `@@unique([stateId, cityName])`.

## Users & Auth

- **`User`** (`users`) — `userId` PK · `userName` · `password` · `emailId` unique · `mobileNo` · `gender?` · `emailVerified` · uses `creationDate`/`modificationDate`. Relations: `passkeys`, `userRoles`, `emailOtps`, `dealerWiseUsers`, `assignedProcessTasks` (`ProcessTask` via `ProcessTaskAssignee`).
- **`EmailOtp`** (`email_otps`) — `emailOtpId` PK · `email` · `userId` FK→User (cascade) · `purpose` (OtpPurpose) · `otpHash` · `expiresAt` · `@@index([email, purpose])`.
- **`Passkey`** (`passkeys`) — `id` PK · `userId` FK→User (cascade) · `credentialId` unique · `credentialPublicKey` Bytes · `counter` · `transports?` · `deviceType?` · `backedUp`.

## Dealers

- **`Dealer`** (`dealers`) — `dealerId` PK · `firmName` · `dealerName` · `address` · `city` · `state` · `pincode` · `mobileNo` unique · `emailId` unique · `displayName` · `whatsappNo` unique · `isSubscribe` (bool, default false). Relations: `dealerStatuses`, `dealerReferences`, `vehicleProcesses`, `processReferences`, `dealerWiseUploadCategories`, `dealerWiseUsers`.
- **`DealerStatus`** (`dealer_status`) — `statusId` PK · `dealerId` FK→Dealer (cascade) · `statusName` · `colour?` · `statusRank` · `@@unique([dealerId, statusName])`. *Per-dealer kanban statuses; rank assigned sequentially per dealer.*
- **`DealerReference`** (`dealer_references`) — `referenceId` PK · `dealerId?` FK→Dealer · `referenceName` · `referenceNumber` · → `processReferences`.
- **`DealerWiseUser`** (`dealer_wise_user`) — `dwuId` PK · `userId` **unique** FK→User (cascade) · `dealerId` FK→Dealer (cascade) · `@@index([dealerId])`. *User↔Dealer is 1:1 (a user belongs to one dealer).*

## Master data

- **`RtoService`** (`rto_services`) — `serviceId` PK · `serviceName` unique · `shortName` unique · `orderRank`.
- **`UploadCategory`** (`upload_category`) — `categoryId` PK · `categoryName` unique · `orderRank` · `bothSide` · → `dealerWiseUploadCategories`.
- **`DealerWiseUploadCategory`** (`dealer_wise_upload_category`) — `dwucId` PK · `dealerId` FK→Dealer (cascade) · `uploadCategoryId` FK→UploadCategory (cascade) · `processApi?` · `orderRank` (per dealer) · `isRequired` · `isProcess` · `isViewInStep` · `@@unique([dealerId, uploadCategoryId])` · `@@index([dealerId])` · → `processUploadImages`.

## Vehicles & Process

- **`Vehicle`** (`vehicles`) — `vehicleId` PK · `registrationNumber` unique · `chassisNumber?` unique · `engineNumber?` unique · `vehicleType?` · `make?` · `model?` · `registrationDate?` (Date) · `manufactureMonth?` · `manufactureYear?` · → `vehicleProcesses`. *Most fields nullable to support OCR-partial entry.*
- **`VehicleProcess`** (`vehicle_process`) — `processId` PK · `vehicleId?` FK→Vehicle · `dealerId?` FK→Dealer · `status?` (free text) · `processDate?`. Relations: `persons`, `processReferences`, `processUploadImages`, `processUploadPhotos`, `processTasks`. *The central transaction; a vehicle has many.*
- **`Person`** (`persons`) — `personId` PK · `personName` · `address?` · `mobileNumber` · `personType` (SELLER/BUYER) · `processId` FK→VehicleProcess (cascade).
- **`ProcessReference`** (`process_references`) — `processReferenceId` PK · `processId?` FK→VehicleProcess · `referenceId?` FK→DealerReference · `dealerId?` FK→Dealer · `referenceType?` (BUY/SELL).
- **`ProcessUploadImage`** (`process_upload_image`) — `processUploadImageId` PK · `imageName` · `imageLink` (Text) · `processId` FK→VehicleProcess (cascade) · `dwucId` FK→DealerWiseUploadCategory (cascade) · `@@index([processId])` `@@index([dwucId])`.
- **`ProcessUploadPhoto`** (`process_upload_photo`) — `processUploadPhotoId` PK · `processId` FK→VehicleProcess (cascade) · `category` · `imageName` · `@@index([processId])`.
- **`ProcessTask`** (`process_task`) — `processTaskId` PK · `processId` FK→VehicleProcess (cascade) · `taskName` · `taskDate` · `assignUserId?` FK→User (setNull) · `@@index([processId])` `@@index([assignUserId])`.

## RBAC

> Effective rule in app code: **missing `RolePermission` row = deny**; `isAllowed: false` = explicit deny.

- **`Role`** (`roles`) — `roleId` PK · `roleName` · `roleType` (RoleType) · `typeId` (dealer or agent id) · `@@unique([typeId, roleName])` · `@@index([roleType, typeId])` · → `permissions`, `userRoles`.
- **`Module`** (`modules`) — `moduleId` PK · `moduleName` · `moduleType` (RoleType) · `description?` · `sortOrder` · `@@unique([moduleType, moduleName])` · → `pages`.
- **`Page`** (`pages`) — `pageId` PK · `moduleId` FK→Module (cascade) · `pageName` · `slug` · `description?` · `sortOrder` · `@@unique([moduleId, slug])` · → `actions`, `permissions`.
- **`PageAction`** (`page_actions`) — `actionId` PK · `pageId` FK→Page (cascade) · `actionName` (e.g. VIEW/CREATE/UPDATE/DELETE/EXPORT) · `label?` · `sortOrder` · `@@unique([pageId, actionName])`.
- **`RolePermission`** (`role_permissions`) — `rolePermissionId` PK · `roleId` FK→Role (cascade) · `pageId` FK→Page (cascade) · `actionId` FK→PageAction (cascade) · `isAllowed` (default true) · `@@unique([roleId, pageId, actionId])`.
- **`UserRole`** (`user_roles`) — composite PK `@@id([userId, roleId])` · `userId` FK→User (cascade) · `roleId` FK→Role (cascade).
