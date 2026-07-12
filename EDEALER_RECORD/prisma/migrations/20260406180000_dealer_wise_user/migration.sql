-- CreateTable
CREATE TABLE "dealer_wise_user" (
    "dwu_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "dealer_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dealer_wise_user_pkey" PRIMARY KEY ("dwu_id")
);

CREATE UNIQUE INDEX "dealer_wise_user_dealer_id_user_id_key" ON "dealer_wise_user"("dealer_id", "user_id");

CREATE INDEX "dealer_wise_user_dealer_id_idx" ON "dealer_wise_user"("dealer_id");

CREATE INDEX "dealer_wise_user_user_id_idx" ON "dealer_wise_user"("user_id");

ALTER TABLE "dealer_wise_user" ADD CONSTRAINT "dealer_wise_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dealer_wise_user" ADD CONSTRAINT "dealer_wise_user_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("dealer_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dealer_wise_user" ADD CONSTRAINT "dealer_wise_user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;
