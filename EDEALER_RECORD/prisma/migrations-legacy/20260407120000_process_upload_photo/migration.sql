-- Named upload photo rows per vehicle process (category + image name).

CREATE TABLE "process_upload_photo" (
    "process_upload_photo_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "process_id" UUID NOT NULL,
    "category" VARCHAR(255) NOT NULL,
    "image_name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "process_upload_photo_pkey" PRIMARY KEY ("process_upload_photo_id")
);

CREATE INDEX "process_upload_photo_process_id_idx" ON "process_upload_photo" ("process_id");

ALTER TABLE "process_upload_photo"
ADD CONSTRAINT "process_upload_photo_process_id_fkey"
FOREIGN KEY ("process_id") REFERENCES "vehicle_process" ("process_id") ON DELETE CASCADE ON UPDATE CASCADE;
