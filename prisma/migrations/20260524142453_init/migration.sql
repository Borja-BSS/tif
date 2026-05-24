-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ANALYST', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('TRAFFIC_INCIDENT', 'ROAD_CLOSURE', 'BORDER_CONGESTION', 'PUBLIC_TRANSPORT_DISRUPTION', 'DEMONSTRATION', 'CONSTRUCTION', 'WEATHER_IMPACT', 'EMERGENCY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "consentAt" TIMESTAMPTZ NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPii" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "emailEncrypted" TEXT NOT NULL,
    "nameEncrypted" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "UserPii_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "userAgent" VARCHAR(500),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totpSecret" TEXT,
    "totpVerified" BOOLEAN NOT NULL DEFAULT false,
    "backupCodes" TEXT[],
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MfaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritorialEvent" (
    "id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "geohash" VARCHAR(12) NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL,
    "officialStatus" TEXT,
    "realityStatus" TEXT,
    "sourceCount" INTEGER NOT NULL DEFAULT 1,
    "sourceWeights" JSONB NOT NULL,
    "detectedAt" TIMESTAMPTZ NOT NULL,
    "verifiedAt" TIMESTAMPTZ,
    "resolvedAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "titleFr" VARCHAR(200) NOT NULL,
    "titleEn" VARCHAR(200),
    "descriptionFr" VARCHAR(1000),
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',

    CONSTRAINT "TerritorialEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobilitySignal" (
    "id" TEXT NOT NULL,
    "geohash6" VARCHAR(6) NOT NULL,
    "deviceHash" VARCHAR(64) NOT NULL,
    "speedBucket" INTEGER NOT NULL,
    "direction" INTEGER,
    "timestamp" TIMESTAMPTZ NOT NULL,
    "datePartition" VARCHAR(10) NOT NULL,

    CONSTRAINT "MobilitySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobilityConsent" (
    "userId" TEXT NOT NULL,
    "location" BOOLEAN NOT NULL DEFAULT false,
    "mobility" BOOLEAN NOT NULL DEFAULT false,
    "devicePresence" BOOLEAN NOT NULL DEFAULT false,
    "consentedAt" TIMESTAMPTZ NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "consentVersion" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TrafficZone" (
    "id" TEXT NOT NULL,
    "geohash6" VARCHAR(6) NOT NULL,
    "deviceCount" INTEGER NOT NULL DEFAULT 0,
    "avgSpeedBucket" DOUBLE PRECISION,
    "congestionScore" DOUBLE PRECISION,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TrafficZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPii_userId_key" ON "UserPii"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPii_emailHash_key" ON "UserPii"("emailHash");

-- CreateIndex
CREATE INDEX "UserPii_emailHash_idx" ON "UserPii"("emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "MfaConfig_userId_key" ON "MfaConfig"("userId");

-- CreateIndex
CREATE INDEX "TerritorialEvent_geohash_detectedAt_idx" ON "TerritorialEvent"("geohash", "detectedAt");

-- CreateIndex
CREATE INDEX "TerritorialEvent_type_confidence_idx" ON "TerritorialEvent"("type", "confidence");

-- CreateIndex
CREATE INDEX "TerritorialEvent_expiresAt_idx" ON "TerritorialEvent"("expiresAt");

-- CreateIndex
CREATE INDEX "TerritorialEvent_severity_detectedAt_idx" ON "TerritorialEvent"("severity", "detectedAt");

-- CreateIndex
CREATE INDEX "MobilitySignal_geohash6_timestamp_idx" ON "MobilitySignal"("geohash6", "timestamp");

-- CreateIndex
CREATE INDEX "MobilitySignal_datePartition_idx" ON "MobilitySignal"("datePartition");

-- CreateIndex
CREATE UNIQUE INDEX "MobilityConsent_userId_key" ON "MobilityConsent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrafficZone_geohash6_key" ON "TrafficZone"("geohash6");

-- CreateIndex
CREATE INDEX "TrafficZone_geohash6_idx" ON "TrafficZone"("geohash6");

-- CreateIndex
CREATE INDEX "TrafficZone_congestionScore_idx" ON "TrafficZone"("congestionScore");

-- AddForeignKey
ALTER TABLE "UserPii" ADD CONSTRAINT "UserPii_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaConfig" ADD CONSTRAINT "MfaConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityConsent" ADD CONSTRAINT "MobilityConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
