-- AlterTable: remove columns from global upload categories
ALTER TABLE "upload_category" DROP COLUMN IF EXISTS "initial_upload";
ALTER TABLE "upload_category" DROP COLUMN IF EXISTS "is_required";

-- CreateTable
CREATE TABLE "dealer_wise_upload_category" (
    "dwu_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealer_id" UUID NOT NULL,
    "upload_category_id" UUID NOT NULL,
    "process_api" VARCHAR(512),
    "order_rank" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_process" BOOLEAN NOT NULL DEFAULT false,
    "is_view_in_step" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dealer_wise_upload_category_pkey" PRIMARY KEY ("dwu_id")
);

CREATE UNIQUE INDEX "dealer_wise_upload_category_dealer_id_upload_category_id_key" ON "dealer_wise_upload_category"("dealer_id", "upload_category_id");

CREATE INDEX "dealer_wise_upload_category_dealer_id_idx" ON "dealer_wise_upload_category"("dealer_id");

ALTER TABLE "dealer_wise_upload_category" ADD CONSTRAINT "dealer_wise_upload_category_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealer_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dealer_wise_upload_category" ADD CONSTRAINT "dealer_wise_upload_category_upload_category_id_fkey" FOREIGN KEY ("upload_category_id") REFERENCES "upload_category"("category_id") ON DELETE CASCADE ON UPDATE CASCADE;
