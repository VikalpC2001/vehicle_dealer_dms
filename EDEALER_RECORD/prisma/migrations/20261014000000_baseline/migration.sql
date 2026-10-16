-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('SELLER', 'BUYER');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('DEALER', 'AGENT');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('SIGNUP_EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "DealerAgentStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "DealerAgentSource" AS ENUM ('DEALER_GRANT', 'CONNECT');

-- CreateEnum
CREATE TYPE "AgentInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "CommentAuthorRole" AS ENUM ('DEALER', 'AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VehicleProcessStatus" AS ENUM ('SOLD', 'COMPLETE', 'SCRAP');

-- CreateEnum
CREATE TYPE "ProcessPhotoKind" AS ENUM ('DOCUMENT', 'VEHICLE');

-- CreateTable
CREATE TABLE "state_data" (
    "state_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "state_name" VARCHAR(255) NOT NULL,
    "creation_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modification_date" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "state_data_pkey" PRIMARY KEY ("state_id")
);

-- CreateTable
CREATE TABLE "city_data" (
    "city_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "state_id" UUID NOT NULL,
    "city_name" VARCHAR(255) NOT NULL,
    "creation_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modification_date" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "city_data_pkey" PRIMARY KEY ("city_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_name" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "email_id" VARCHAR(255) NOT NULL,
    "mobile_no" VARCHAR(20) NOT NULL,
    "gender" VARCHAR(50),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "creation_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modification_date" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "email_otps" (
    "email_otp_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "otp_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("email_otp_id")
);

-- CreateTable
CREATE TABLE "passkeys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "credential_id" VARCHAR(512) NOT NULL,
    "credential_public_key" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" VARCHAR(255),
    "device_type" VARCHAR(50),
    "backed_up" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealers" (
    "dealerId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_name" VARCHAR(255) NOT NULL,
    "dealer_name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "pincode" VARCHAR(10),
    "mobile_no" VARCHAR(20),
    "email_id" VARCHAR(255),
    "display_name" VARCHAR(255) NOT NULL,
    "whatsapp_no" VARCHAR(20),
    "is_subscribe" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "approval_reason" TEXT,
    "max_agents" INTEGER NOT NULL DEFAULT 2,
    "is_placeholder" BOOLEAN NOT NULL DEFAULT false,
    "owner_agent_id" UUID,
    "connected_dealer_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dealers_pkey" PRIMARY KEY ("dealerId")
);

-- CreateTable
CREATE TABLE "agents" (
    "agentId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_name" VARCHAR(255) NOT NULL,
    "agent_name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "pincode" VARCHAR(10),
    "mobile_no" VARCHAR(20),
    "email_id" VARCHAR(255),
    "display_name" VARCHAR(255) NOT NULL,
    "whatsapp_no" VARCHAR(20),
    "is_subscribe" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "approval_reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("agentId")
);

-- CreateTable
CREATE TABLE "agent_wise_user" (
    "awu_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "agent_wise_user_pkey" PRIMARY KEY ("awu_id")
);

-- CreateTable
CREATE TABLE "dealer_agent" (
    "dealer_agent_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealer_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "status" "DealerAgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "DealerAgentSource" NOT NULL DEFAULT 'DEALER_GRANT',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dealer_agent_pkey" PRIMARY KEY ("dealer_agent_id")
);

-- CreateTable
CREATE TABLE "agent_invitation" (
    "invitation_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealer_id" UUID NOT NULL,
    "agent_name" VARCHAR(255) NOT NULL,
    "email_id" VARCHAR(255) NOT NULL,
    "mobile_no" VARCHAR(20),
    "token_hash" VARCHAR(64) NOT NULL,
    "status" "AgentInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(6) NOT NULL,
    "accepted_at" TIMESTAMP(6),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "agent_invitation_pkey" PRIMARY KEY ("invitation_id")
);

-- CreateTable
CREATE TABLE "agent_status" (
    "statusId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "status_name" VARCHAR(255) NOT NULL,
    "colour" VARCHAR(50),
    "status_rank" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "agent_status_pkey" PRIMARY KEY ("statusId")
);

-- CreateTable
CREATE TABLE "process_assignment" (
    "assignment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "process_id" UUID NOT NULL,
    "dealer_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "agent_status_id" UUID,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "assigned_by_user_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "process_assignment_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "khata_account" (
    "khata_account_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealer_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "khata_account_pkey" PRIMARY KEY ("khata_account_id")
);

-- CreateTable
CREATE TABLE "ledger_entry" (
    "ledger_entry_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "khata_account_id" UUID NOT NULL,
    "dealer_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balance_after" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "entry_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seq" BIGSERIAL NOT NULL,
    "posted_by_user_id" UUID,
    "posted_by_role" "RoleType" NOT NULL,
    "assignment_id" UUID,
    "source_dealer_id" UUID,
    "reverses_entry_id" UUID,
    "is_reversed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entry_pkey" PRIMARY KEY ("ledger_entry_id")
);

-- CreateTable
CREATE TABLE "rto_services" (
    "serviceId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_name" VARCHAR(255) NOT NULL,
    "short_name" VARCHAR(50) NOT NULL,
    "order_rank" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "rto_services_pkey" PRIMARY KEY ("serviceId")
);

-- CreateTable
CREATE TABLE "upload_category" (
    "category_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_name" VARCHAR(255) NOT NULL,
    "order_rank" INTEGER NOT NULL DEFAULT 0,
    "both_side" BOOLEAN NOT NULL DEFAULT false,
    "process_api" VARCHAR(512),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "upload_category_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "dealer_wise_upload_category" (
    "dwuc_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealer_id" UUID NOT NULL,
    "upload_category_id" UUID NOT NULL,
    "process_api" VARCHAR(512),
    "order_rank" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_process" BOOLEAN NOT NULL DEFAULT false,
    "is_view_in_step" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dealer_wise_upload_category_pkey" PRIMARY KEY ("dwuc_id")
);

-- CreateTable
CREATE TABLE "agent_wise_upload_category" (
    "awuc_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "upload_category_id" UUID NOT NULL,
    "process_api" VARCHAR(512),
    "order_rank" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_process" BOOLEAN NOT NULL DEFAULT false,
    "is_view_in_step" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "agent_wise_upload_category_pkey" PRIMARY KEY ("awuc_id")
);

-- CreateTable
CREATE TABLE "dealer_wise_user" (
    "dwu_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "dealer_id" UUID NOT NULL,
    "is_owner" BOOLEAN NOT NULL DEFAULT false,
    "role_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dealer_wise_user_pkey" PRIMARY KEY ("dwu_id")
);

-- CreateTable
CREATE TABLE "dealer_role" (
    "roleId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealer_id" UUID NOT NULL,
    "role_name" VARCHAR(255) NOT NULL,
    "capabilities" TEXT[],
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dealer_role_pkey" PRIMARY KEY ("roleId")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "vehicleId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "registration_number" VARCHAR(50) NOT NULL,
    "chassis_number" VARCHAR(100),
    "engine_number" VARCHAR(100),
    "vehicle_type" VARCHAR(50),
    "make" VARCHAR(100),
    "model" VARCHAR(100),
    "registration_date" DATE,
    "manufacture_month" INTEGER,
    "manufacture_year" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("vehicleId")
);

-- CreateTable
CREATE TABLE "dealer_task_status" (
    "statusId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealer_id" UUID NOT NULL,
    "status_name" VARCHAR(255) NOT NULL,
    "colour" VARCHAR(50),
    "status_rank" INTEGER NOT NULL DEFAULT 0,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dealer_task_status_pkey" PRIMARY KEY ("statusId")
);

-- CreateTable
CREATE TABLE "dealer_task_template" (
    "templateId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealer_id" UUID NOT NULL,
    "template_name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dealer_task_template_pkey" PRIMARY KEY ("templateId")
);

-- CreateTable
CREATE TABLE "dealer_tag" (
    "tag_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealer_id" UUID NOT NULL,
    "tag_name" VARCHAR(255) NOT NULL,
    "colour" VARCHAR(50),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dealer_tag_pkey" PRIMARY KEY ("tag_id")
);

-- CreateTable
CREATE TABLE "dealer_references" (
    "referenceId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealer_id" UUID,
    "reference_name" VARCHAR(255) NOT NULL,
    "reference_number" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dealer_references_pkey" PRIMARY KEY ("referenceId")
);

-- CreateTable
CREATE TABLE "vehicle_process" (
    "processId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vehicle_id" UUID,
    "dealer_id" UUID,
    "agent_status_id" UUID,
    "process_date" TIMESTAMP(6),
    "purchase_price" DECIMAL(14,2),
    "sale_price" DECIMAL(14,2),
    "price_currency" VARCHAR(3) DEFAULT 'INR',
    "receipt_image_name" VARCHAR(512),
    "receipt_uploaded_at" TIMESTAMP(6),
    "tracking_number" VARCHAR(255),
    "status" "VehicleProcessStatus",
    "deal_number" VARCHAR(100),
    "sold_date" TIMESTAMP(6),
    "buyer_changed_at" TIMESTAMP(6),
    "deleted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "vehicle_process_pkey" PRIMARY KEY ("processId")
);

-- CreateTable
CREATE TABLE "process_expenses" (
    "expenseId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "process_id" UUID NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "category" VARCHAR(50),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "process_expenses_pkey" PRIMARY KEY ("expenseId")
);

-- CreateTable
CREATE TABLE "process_tag" (
    "process_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_tag_pkey" PRIMARY KEY ("process_id","tag_id")
);

-- CreateTable
CREATE TABLE "process_upload_image" (
    "process_upload_image_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "image_name" VARCHAR(255) NOT NULL,
    "image_link" TEXT NOT NULL,
    "process_id" UUID NOT NULL,
    "dwuc_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "process_upload_image_pkey" PRIMARY KEY ("process_upload_image_id")
);

-- CreateTable
CREATE TABLE "process_upload_photo" (
    "process_upload_photo_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "process_id" UUID NOT NULL,
    "category" VARCHAR(255) NOT NULL,
    "image_name" VARCHAR(255) NOT NULL,
    "kind" "ProcessPhotoKind" NOT NULL DEFAULT 'DOCUMENT',
    "is_starred" BOOLEAN NOT NULL DEFAULT false,
    "person_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "process_upload_photo_pkey" PRIMARY KEY ("process_upload_photo_id")
);

-- CreateTable
CREATE TABLE "process_task" (
    "process_task_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "process_id" UUID NOT NULL,
    "task_name" VARCHAR(512) NOT NULL,
    "task_date" TIMESTAMP(6) NOT NULL,
    "assign_user_id" UUID,
    "status" VARCHAR(50) NOT NULL DEFAULT 'To-Do',
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "process_task_pkey" PRIMARY KEY ("process_task_id")
);

-- CreateTable
CREATE TABLE "process_comment" (
    "comment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "process_id" UUID NOT NULL,
    "author_user_id" UUID,
    "author_role" "CommentAuthorRole" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "process_comment_pkey" PRIMARY KEY ("comment_id")
);

-- CreateTable
CREATE TABLE "task_comment" (
    "comment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "process_task_id" UUID NOT NULL,
    "author_user_id" UUID,
    "author_role" "CommentAuthorRole" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "task_comment_pkey" PRIMARY KEY ("comment_id")
);

-- CreateTable
CREATE TABLE "persons" (
    "personId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "mobile_number" VARCHAR(20) NOT NULL,
    "person_type" "PersonType" NOT NULL,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "process_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("personId")
);

-- CreateTable
CREATE TABLE "process_references" (
    "process_reference_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "process_id" UUID,
    "reference_id" UUID,
    "dealer_id" UUID,
    "reference_type" "ReferenceType",
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "process_references_pkey" PRIMARY KEY ("process_reference_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "role_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_name" VARCHAR(255) NOT NULL,
    "role_type" "RoleType" NOT NULL,
    "type_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "modules" (
    "module_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_name" VARCHAR(255) NOT NULL,
    "module_type" "RoleType" NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("module_id")
);

-- CreateTable
CREATE TABLE "pages" (
    "page_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" UUID NOT NULL,
    "page_name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("page_id")
);

-- CreateTable
CREATE TABLE "page_actions" (
    "action_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "page_id" UUID NOT NULL,
    "action_name" VARCHAR(64) NOT NULL,
    "label" VARCHAR(128),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "page_actions_pkey" PRIMARY KEY ("action_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_permission_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "action_id" UUID NOT NULL,
    "is_allowed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "state_data_state_name_key" ON "state_data"("state_name");

-- CreateIndex
CREATE UNIQUE INDEX "city_data_state_id_city_name_key" ON "city_data"("state_id", "city_name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_id_key" ON "users"("email_id");

-- CreateIndex
CREATE INDEX "email_otps_email_purpose_idx" ON "email_otps"("email", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "passkeys_credential_id_key" ON "passkeys"("credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealers_mobile_no_key" ON "dealers"("mobile_no");

-- CreateIndex
CREATE UNIQUE INDEX "dealers_email_id_key" ON "dealers"("email_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealers_whatsapp_no_key" ON "dealers"("whatsapp_no");

-- CreateIndex
CREATE INDEX "dealers_owner_agent_id_idx" ON "dealers"("owner_agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "agents_mobile_no_key" ON "agents"("mobile_no");

-- CreateIndex
CREATE UNIQUE INDEX "agents_email_id_key" ON "agents"("email_id");

-- CreateIndex
CREATE UNIQUE INDEX "agents_whatsapp_no_key" ON "agents"("whatsapp_no");

-- CreateIndex
CREATE UNIQUE INDEX "agent_wise_user_user_id_key" ON "agent_wise_user"("user_id");

-- CreateIndex
CREATE INDEX "agent_wise_user_agent_id_idx" ON "agent_wise_user"("agent_id");

-- CreateIndex
CREATE INDEX "dealer_agent_dealer_id_idx" ON "dealer_agent"("dealer_id");

-- CreateIndex
CREATE INDEX "dealer_agent_agent_id_idx" ON "dealer_agent"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_agent_dealer_id_agent_id_key" ON "dealer_agent"("dealer_id", "agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_invitation_token_hash_key" ON "agent_invitation"("token_hash");

-- CreateIndex
CREATE INDEX "agent_invitation_dealer_id_idx" ON "agent_invitation"("dealer_id");

-- CreateIndex
CREATE INDEX "agent_invitation_email_id_idx" ON "agent_invitation"("email_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_status_agent_id_status_name_key" ON "agent_status"("agent_id", "status_name");

-- CreateIndex
CREATE INDEX "process_assignment_agent_id_idx" ON "process_assignment"("agent_id");

-- CreateIndex
CREATE INDEX "process_assignment_dealer_id_idx" ON "process_assignment"("dealer_id");

-- CreateIndex
CREATE INDEX "process_assignment_process_id_idx" ON "process_assignment"("process_id");

-- CreateIndex
CREATE UNIQUE INDEX "process_assignment_process_id_agent_id_service_id_key" ON "process_assignment"("process_id", "agent_id", "service_id");

-- CreateIndex
CREATE INDEX "khata_account_dealer_id_idx" ON "khata_account"("dealer_id");

-- CreateIndex
CREATE INDEX "khata_account_agent_id_idx" ON "khata_account"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "khata_account_dealer_id_agent_id_key" ON "khata_account"("dealer_id", "agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entry_reverses_entry_id_key" ON "ledger_entry"("reverses_entry_id");

-- CreateIndex
CREATE INDEX "ledger_entry_khata_account_id_seq_idx" ON "ledger_entry"("khata_account_id", "seq");

-- CreateIndex
CREATE INDEX "ledger_entry_dealer_id_idx" ON "ledger_entry"("dealer_id");

-- CreateIndex
CREATE INDEX "ledger_entry_agent_id_idx" ON "ledger_entry"("agent_id");

-- CreateIndex
CREATE INDEX "ledger_entry_assignment_id_idx" ON "ledger_entry"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "rto_services_service_name_key" ON "rto_services"("service_name");

-- CreateIndex
CREATE UNIQUE INDEX "rto_services_short_name_key" ON "rto_services"("short_name");

-- CreateIndex
CREATE UNIQUE INDEX "upload_category_category_name_key" ON "upload_category"("category_name");

-- CreateIndex
CREATE INDEX "dealer_wise_upload_category_dealer_id_idx" ON "dealer_wise_upload_category"("dealer_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_wise_upload_category_dealer_id_upload_category_id_key" ON "dealer_wise_upload_category"("dealer_id", "upload_category_id");

-- CreateIndex
CREATE INDEX "agent_wise_upload_category_agent_id_idx" ON "agent_wise_upload_category"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_wise_upload_category_agent_id_upload_category_id_key" ON "agent_wise_upload_category"("agent_id", "upload_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_wise_user_user_id_key" ON "dealer_wise_user"("user_id");

-- CreateIndex
CREATE INDEX "dealer_wise_user_dealer_id_idx" ON "dealer_wise_user"("dealer_id");

-- CreateIndex
CREATE INDEX "dealer_wise_user_role_id_idx" ON "dealer_wise_user"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_role_dealer_id_role_name_key" ON "dealer_role"("dealer_id", "role_name");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_registration_number_key" ON "vehicles"("registration_number");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_chassis_number_key" ON "vehicles"("chassis_number");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_engine_number_key" ON "vehicles"("engine_number");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_task_status_dealer_id_status_name_key" ON "dealer_task_status"("dealer_id", "status_name");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_task_template_dealer_id_template_name_key" ON "dealer_task_template"("dealer_id", "template_name");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_tag_dealer_id_tag_name_key" ON "dealer_tag"("dealer_id", "tag_name");

-- CreateIndex
CREATE INDEX "vehicle_process_vehicle_id_idx" ON "vehicle_process"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_process_agent_status_id_idx" ON "vehicle_process"("agent_status_id");

-- CreateIndex
CREATE INDEX "vehicle_process_dealer_id_deleted_at_idx" ON "vehicle_process"("dealer_id", "deleted_at");

-- CreateIndex
CREATE INDEX "process_expenses_process_id_idx" ON "process_expenses"("process_id");

-- CreateIndex
CREATE INDEX "process_tag_tag_id_idx" ON "process_tag"("tag_id");

-- CreateIndex
CREATE INDEX "process_upload_image_process_id_idx" ON "process_upload_image"("process_id");

-- CreateIndex
CREATE INDEX "process_upload_image_dwuc_id_idx" ON "process_upload_image"("dwuc_id");

-- CreateIndex
CREATE INDEX "process_upload_photo_process_id_idx" ON "process_upload_photo"("process_id");

-- CreateIndex
CREATE INDEX "process_upload_photo_person_id_idx" ON "process_upload_photo"("person_id");

-- CreateIndex
CREATE INDEX "process_task_process_id_idx" ON "process_task"("process_id");

-- CreateIndex
CREATE INDEX "process_task_assign_user_id_idx" ON "process_task"("assign_user_id");

-- CreateIndex
CREATE INDEX "process_task_completed_at_idx" ON "process_task"("completed_at");

-- CreateIndex
CREATE INDEX "process_comment_process_id_created_at_idx" ON "process_comment"("process_id", "created_at");

-- CreateIndex
CREATE INDEX "task_comment_process_task_id_created_at_idx" ON "task_comment"("process_task_id", "created_at");

-- CreateIndex
CREATE INDEX "persons_process_id_idx" ON "persons"("process_id");

-- CreateIndex
CREATE INDEX "roles_role_type_type_id_idx" ON "roles"("role_type", "type_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_type_id_role_name_key" ON "roles"("type_id", "role_name");

-- CreateIndex
CREATE UNIQUE INDEX "modules_module_type_module_name_key" ON "modules"("module_type", "module_name");

-- CreateIndex
CREATE INDEX "pages_module_id_idx" ON "pages"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "pages_module_id_slug_key" ON "pages"("module_id", "slug");

-- CreateIndex
CREATE INDEX "page_actions_page_id_idx" ON "page_actions"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "page_actions_page_id_action_name_key" ON "page_actions"("page_id", "action_name");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_page_id_idx" ON "role_permissions"("page_id");

-- CreateIndex
CREATE INDEX "role_permissions_action_id_idx" ON "role_permissions"("action_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_page_id_action_id_key" ON "role_permissions"("role_id", "page_id", "action_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- AddForeignKey
ALTER TABLE "city_data" ADD CONSTRAINT "city_data_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "state_data"("state_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_otps" ADD CONSTRAINT "email_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_owner_agent_id_fkey" FOREIGN KEY ("owner_agent_id") REFERENCES "agents"("agentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_connected_dealer_id_fkey" FOREIGN KEY ("connected_dealer_id") REFERENCES "dealers"("dealerId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_wise_user" ADD CONSTRAINT "agent_wise_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_wise_user" ADD CONSTRAINT "agent_wise_user_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("agentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_agent" ADD CONSTRAINT "dealer_agent_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_agent" ADD CONSTRAINT "dealer_agent_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("agentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_invitation" ADD CONSTRAINT "agent_invitation_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_status" ADD CONSTRAINT "agent_status_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("agentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_assignment" ADD CONSTRAINT "process_assignment_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "vehicle_process"("processId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_assignment" ADD CONSTRAINT "process_assignment_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_assignment" ADD CONSTRAINT "process_assignment_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("agentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_assignment" ADD CONSTRAINT "process_assignment_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "rto_services"("serviceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_assignment" ADD CONSTRAINT "process_assignment_agent_status_id_fkey" FOREIGN KEY ("agent_status_id") REFERENCES "agent_status"("statusId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_assignment" ADD CONSTRAINT "process_assignment_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "khata_account" ADD CONSTRAINT "khata_account_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "khata_account" ADD CONSTRAINT "khata_account_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("agentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_khata_account_id_fkey" FOREIGN KEY ("khata_account_id") REFERENCES "khata_account"("khata_account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("agentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "process_assignment"("assignment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_reverses_entry_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "ledger_entry"("ledger_entry_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_wise_upload_category" ADD CONSTRAINT "dealer_wise_upload_category_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_wise_upload_category" ADD CONSTRAINT "dealer_wise_upload_category_upload_category_id_fkey" FOREIGN KEY ("upload_category_id") REFERENCES "upload_category"("category_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_wise_upload_category" ADD CONSTRAINT "agent_wise_upload_category_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("agentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_wise_upload_category" ADD CONSTRAINT "agent_wise_upload_category_upload_category_id_fkey" FOREIGN KEY ("upload_category_id") REFERENCES "upload_category"("category_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_wise_user" ADD CONSTRAINT "dealer_wise_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_wise_user" ADD CONSTRAINT "dealer_wise_user_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_wise_user" ADD CONSTRAINT "dealer_wise_user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "dealer_role"("roleId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_role" ADD CONSTRAINT "dealer_role_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_task_status" ADD CONSTRAINT "dealer_task_status_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_task_template" ADD CONSTRAINT "dealer_task_template_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_tag" ADD CONSTRAINT "dealer_tag_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_references" ADD CONSTRAINT "dealer_references_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_process" ADD CONSTRAINT "vehicle_process_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("vehicleId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_process" ADD CONSTRAINT "vehicle_process_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_process" ADD CONSTRAINT "vehicle_process_agent_status_id_fkey" FOREIGN KEY ("agent_status_id") REFERENCES "agent_status"("statusId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_expenses" ADD CONSTRAINT "process_expenses_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "vehicle_process"("processId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_tag" ADD CONSTRAINT "process_tag_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "vehicle_process"("processId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_tag" ADD CONSTRAINT "process_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "dealer_tag"("tag_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_upload_image" ADD CONSTRAINT "process_upload_image_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "vehicle_process"("processId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_upload_image" ADD CONSTRAINT "process_upload_image_dwuc_id_fkey" FOREIGN KEY ("dwuc_id") REFERENCES "dealer_wise_upload_category"("dwuc_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_upload_photo" ADD CONSTRAINT "process_upload_photo_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "vehicle_process"("processId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_upload_photo" ADD CONSTRAINT "process_upload_photo_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("personId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_task" ADD CONSTRAINT "process_task_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "vehicle_process"("processId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_task" ADD CONSTRAINT "process_task_assign_user_id_fkey" FOREIGN KEY ("assign_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_comment" ADD CONSTRAINT "process_comment_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "vehicle_process"("processId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_comment" ADD CONSTRAINT "process_comment_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_process_task_id_fkey" FOREIGN KEY ("process_task_id") REFERENCES "process_task"("process_task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "vehicle_process"("processId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_references" ADD CONSTRAINT "process_references_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "vehicle_process"("processId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_references" ADD CONSTRAINT "process_references_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "dealer_references"("referenceId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_references" ADD CONSTRAINT "process_references_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealerId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_actions" ADD CONSTRAINT "page_actions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("page_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("page_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "page_actions"("action_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

