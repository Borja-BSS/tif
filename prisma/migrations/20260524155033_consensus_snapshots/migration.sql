-- CreateTable
CREATE TABLE "ZoneConsensusSnapshot" (
    "id" TEXT NOT NULL,
    "geohash6" VARCHAR(6) NOT NULL,
    "consensus" JSONB NOT NULL,
    "computedAt" TIMESTAMPTZ NOT NULL,
    "datePartition" VARCHAR(10) NOT NULL,

    CONSTRAINT "ZoneConsensusSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZoneConsensusSnapshot_geohash6_computedAt_idx" ON "ZoneConsensusSnapshot"("geohash6", "computedAt");

-- CreateIndex
CREATE INDEX "ZoneConsensusSnapshot_datePartition_idx" ON "ZoneConsensusSnapshot"("datePartition");
