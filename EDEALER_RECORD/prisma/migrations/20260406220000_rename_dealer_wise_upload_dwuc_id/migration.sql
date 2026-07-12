-- Rename PK column DealerWiseUploadCategory: dwu_id -> dwuc_id
ALTER TABLE "dealer_wise_upload_category" RENAME COLUMN "dwu_id" TO "dwuc_id";

-- If process_upload_image already exists (optional table), align FK column name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'process_upload_image' AND column_name = 'dwu_id'
  ) THEN
    ALTER TABLE "process_upload_image" RENAME COLUMN "dwu_id" TO "dwuc_id";
  END IF;
END $$;
