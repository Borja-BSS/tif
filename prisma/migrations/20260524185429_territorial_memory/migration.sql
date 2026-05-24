-- CreateTable
CREATE TABLE "TemporalPattern" (
    "id" TEXT NOT NULL,
    "geohash6" VARCHAR(6) NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "hourOfDay" INTEGER NOT NULL,
    "baseline" JSONB NOT NULL,
    "recurringEvents" JSONB NOT NULL DEFAULT '[]',
    "sampleCount" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TemporalPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventResolution" (
    "id" TEXT NOT NULL,
    "eventId" VARCHAR(30) NOT NULL,
    "eventType" VARCHAR(50) NOT NULL,
    "geohash6" VARCHAR(6) NOT NULL,
    "severity" VARCHAR(20) NOT NULL,
    "detectedAt" TIMESTAMPTZ NOT NULL,
    "resolvedAt" TIMESTAMPTZ NOT NULL,
    "officialSourceAt" TIMESTAMPTZ,
    "leadTimeMinutes" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "EventResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemporalPattern_geohash6_idx" ON "TemporalPattern"("geohash6");

-- CreateIndex
CREATE INDEX "TemporalPattern_lastUpdated_idx" ON "TemporalPattern"("lastUpdated");

-- CreateIndex
CREATE UNIQUE INDEX "TemporalPattern_geohash6_dayOfWeek_hourOfDay_key" ON "TemporalPattern"("geohash6", "dayOfWeek", "hourOfDay");

-- CreateIndex
CREATE INDEX "EventResolution_eventType_detectedAt_idx" ON "EventResolution"("eventType", "detectedAt");

-- CreateIndex
CREATE INDEX "EventResolution_detectedAt_idx" ON "EventResolution"("detectedAt");
