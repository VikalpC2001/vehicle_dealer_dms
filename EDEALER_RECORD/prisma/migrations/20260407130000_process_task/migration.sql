-- Tasks per vehicle process; optional assignee (users.user_id).

CREATE TABLE "process_task" (
    "process_task_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "process_id" UUID NOT NULL,
    "task_name" VARCHAR(512) NOT NULL,
    "task_date" TIMESTAMP(6) NOT NULL,
    "assign_user_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "process_task_pkey" PRIMARY KEY ("process_task_id")
);

CREATE INDEX "process_task_process_id_idx" ON "process_task" ("process_id");
CREATE INDEX "process_task_assign_user_id_idx" ON "process_task" ("assign_user_id");

ALTER TABLE "process_task"
ADD CONSTRAINT "process_task_process_id_fkey"
FOREIGN KEY ("process_id") REFERENCES "vehicle_process" ("process_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "process_task"
ADD CONSTRAINT "process_task_assign_user_id_fkey"
FOREIGN KEY ("assign_user_id") REFERENCES "users" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
