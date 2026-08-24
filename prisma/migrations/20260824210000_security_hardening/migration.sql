-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_action_createdAt_idx" ON "SecurityEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "User_evolutionInstance_idx" ON "User"("evolutionInstance");

-- AlterTable: hash existing cancel tokens, then drop plaintext
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "Appointment" ADD COLUMN "cancelTokenHash" TEXT;

UPDATE "Appointment"
SET "cancelTokenHash" = encode(digest("cancelToken", 'sha256'), 'hex')
WHERE "cancelTokenHash" IS NULL;

ALTER TABLE "Appointment" ALTER COLUMN "cancelTokenHash" SET NOT NULL;

CREATE UNIQUE INDEX "Appointment_cancelTokenHash_key" ON "Appointment"("cancelTokenHash");

DROP INDEX IF EXISTS "Appointment_cancelToken_key";

ALTER TABLE "Appointment" DROP COLUMN "cancelToken";

-- RLS: Prisma (table owner) keeps full access. PostgREST anon/authenticated see nothing.
DO $$
DECLARE
  tbl text;
  r text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'User',
    'WorkingHour',
    'ScheduleException',
    'Service',
    'Appointment',
    'NotificationLog',
    'PasswordResetToken',
    'SecurityEvent'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', tbl);
    EXECUTE format('GRANT ALL ON TABLE %I TO CURRENT_USER', tbl);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
      BEGIN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', tbl, r);
      EXCEPTION
        WHEN undefined_object THEN
          NULL;
        WHEN undefined_table THEN
          NULL;
      END;
    END LOOP;
  END LOOP;
END $$;
