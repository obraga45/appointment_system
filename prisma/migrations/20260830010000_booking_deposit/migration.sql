-- Optional booking deposit (sinal) paid directly to the business.

ALTER TABLE "User" ADD COLUMN "depositEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "depositAmount" DECIMAL(10,2);
ALTER TABLE "User" ADD COLUMN "depositMbWay" TEXT;
ALTER TABLE "User" ADD COLUMN "depositIban" TEXT;

ALTER TABLE "Appointment" ADD COLUMN "depositRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN "depositAmount" DECIMAL(10,2);
ALTER TABLE "Appointment" ADD COLUMN "depositExpiresAt" TIMESTAMP(3);

CREATE INDEX "Appointment_status_depositExpiresAt_idx" ON "Appointment"("status", "depositExpiresAt");
