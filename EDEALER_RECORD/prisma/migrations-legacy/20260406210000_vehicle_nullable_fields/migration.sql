-- AlterTable: optional vehicle detail fields (chassis, engine, type, make/model, dates)
ALTER TABLE "vehicles" ALTER COLUMN "chassis_number" DROP NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "engine_number" DROP NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "vehicle_type" DROP NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "make" DROP NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "model" DROP NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "registration_date" DROP NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "manufacture_month" DROP NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "manufacture_year" DROP NOT NULL;
