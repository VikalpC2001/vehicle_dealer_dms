-- AlterTable: drop role FK and column from dealer_wise_user
ALTER TABLE "dealer_wise_user" DROP CONSTRAINT IF EXISTS "dealer_wise_user_role_id_fkey";

ALTER TABLE "dealer_wise_user" DROP COLUMN IF EXISTS "role_id";
