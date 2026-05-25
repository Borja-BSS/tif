-- AlterTable
ALTER TABLE "EventResolution" ALTER COLUMN "geohash6" SET DATA TYPE VARCHAR(15);

-- AlterTable
ALTER TABLE "MobilitySignal" ALTER COLUMN "geohash6" SET DATA TYPE VARCHAR(15);

-- AlterTable
ALTER TABLE "TemporalPattern" ALTER COLUMN "geohash6" SET DATA TYPE VARCHAR(15);

-- AlterTable
ALTER TABLE "TerritorialEvent" ALTER COLUMN "geohash" SET DATA TYPE VARCHAR(15);

-- AlterTable
ALTER TABLE "TrafficZone" ALTER COLUMN "geohash6" SET DATA TYPE VARCHAR(15);

-- AlterTable
ALTER TABLE "ZoneConsensusSnapshot" ALTER COLUMN "geohash6" SET DATA TYPE VARCHAR(15);
