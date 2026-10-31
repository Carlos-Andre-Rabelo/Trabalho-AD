-- CreateEnum
CREATE TYPE "QueueMode" AS ENUM ('SEPARATE_QUEUES', 'SINGLE_QUEUE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PAUSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('ARRIVAL', 'DELIVERY', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "ServiceIntervalStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InterruptionType" AS ENUM ('PROTEIN_SHORTAGE', 'FOOD_REPLENISHMENT', 'SERVICE_HALT', 'OPERATIONAL_ISSUE', 'ATTENDANT_ABSENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "MeasurementMethod" AS ENUM ('MEASURED', 'ESTIMATED');

-- CreateTable users
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable collections
CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "queue_mode" "QueueMode" NOT NULL DEFAULT 'SEPARATE_QUEUES',
    "status" "CollectionStatus" NOT NULL DEFAULT 'DRAFT',
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable attendants
CREATE TABLE "attendants" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendants_pkey" PRIMARY KEY ("id")
);

-- CreateTable queues
CREATE TABLE "queues" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable queue_attendants
CREATE TABLE "queue_attendants" (
    "queue_id" UUID NOT NULL,
    "attendant_id" UUID NOT NULL,

    CONSTRAINT "queue_attendants_pkey" PRIMARY KEY ("queue_id","attendant_id")
);

-- CreateTable events
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "attendant_id" UUID,
    "queue_id" UUID,
    "event_type" "EventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "metadata" JSONB,
    "is_voided" BOOLEAN NOT NULL DEFAULT false,
    "voided_at" TIMESTAMP(3),
    "voided_by" UUID,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_intervals
CREATE TABLE "service_intervals" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "attendant_id" UUID NOT NULL,
    "queue_id" UUID,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "status" "ServiceIntervalStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_intervals_pkey" PRIMARY KEY ("id")
);

-- CreateTable interruptions
CREATE TABLE "interruptions" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "attendant_id" UUID,
    "interruption_type" "InterruptionType" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "notes" TEXT,
    "recorded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interruptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable protein_measurements
CREATE TABLE "protein_measurements" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "attendant_id" UUID NOT NULL,
    "service_interval_id" UUID,
    "amount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "measurement_method" "MeasurementMethod" NOT NULL DEFAULT 'MEASURED',
    "notes" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "protein_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable collection_pauses
CREATE TABLE "collection_pauses" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable audit_logs
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "previous_values" JSONB,
    "new_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "collections_owner_id_idx" ON "collections"("owner_id");
CREATE INDEX "collections_status_idx" ON "collections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendants_collection_id_code_key" ON "attendants"("collection_id", "code");
CREATE INDEX "attendants_collection_id_idx" ON "attendants"("collection_id");

-- CreateIndex
CREATE INDEX "queues_collection_id_idx" ON "queues"("collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_idempotency_key_key" ON "events"("idempotency_key");
CREATE INDEX "events_collection_id_occurred_at_idx" ON "events"("collection_id", "occurred_at");
CREATE INDEX "events_collection_id_attendant_id_idx" ON "events"("collection_id", "attendant_id");
CREATE INDEX "events_collection_id_event_type_idx" ON "events"("collection_id", "event_type");
CREATE INDEX "events_collection_id_is_voided_idx" ON "events"("collection_id", "is_voided");

-- CreateIndex
CREATE INDEX "service_intervals_collection_id_attendant_id_status_idx" ON "service_intervals"("collection_id", "attendant_id", "status");

-- CreateIndex
CREATE INDEX "interruptions_collection_id_idx" ON "interruptions"("collection_id");

-- CreateIndex
CREATE INDEX "protein_measurements_collection_id_attendant_id_idx" ON "protein_measurements"("collection_id", "attendant_id");

-- CreateIndex
CREATE INDEX "collection_pauses_collection_id_idx" ON "collection_pauses"("collection_id");

-- CreateIndex
CREATE INDEX "audit_logs_collection_id_created_at_idx" ON "audit_logs"("collection_id", "created_at");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendants" ADD CONSTRAINT "attendants_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queues" ADD CONSTRAINT "queues_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_attendants" ADD CONSTRAINT "queue_attendants_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "queues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_attendants" ADD CONSTRAINT "queue_attendants_attendant_id_fkey" FOREIGN KEY ("attendant_id") REFERENCES "attendants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_attendant_id_fkey" FOREIGN KEY ("attendant_id") REFERENCES "attendants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "queues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_intervals" ADD CONSTRAINT "service_intervals_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_intervals" ADD CONSTRAINT "service_intervals_attendant_id_fkey" FOREIGN KEY ("attendant_id") REFERENCES "attendants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_intervals" ADD CONSTRAINT "service_intervals_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "queues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interruptions" ADD CONSTRAINT "interruptions_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interruptions" ADD CONSTRAINT "interruptions_attendant_id_fkey" FOREIGN KEY ("attendant_id") REFERENCES "attendants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protein_measurements" ADD CONSTRAINT "protein_measurements_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protein_measurements" ADD CONSTRAINT "protein_measurements_attendant_id_fkey" FOREIGN KEY ("attendant_id") REFERENCES "attendants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protein_measurements" ADD CONSTRAINT "protein_measurements_service_interval_id_fkey" FOREIGN KEY ("service_interval_id") REFERENCES "service_intervals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_pauses" ADD CONSTRAINT "collection_pauses_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
