-- Drop composite unique; enforce one dealer assignment per user globally.
DROP INDEX IF EXISTS "dealer_wise_user_dealer_id_user_id_key";

CREATE UNIQUE INDEX "dealer_wise_user_user_id_key" ON "dealer_wise_user"("user_id");
