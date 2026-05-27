-- CreateEnum
CREATE TYPE "G7DirectiveCategory" AS ENUM (
  'ARMY_DEPLOYMENT',
  'BORDER_CONTROL',
  'AIRSPACE_RESTRICTION',
  'SECURITY_MEASURE',
  'DEMONSTRATION_RULES',
  'COST_SHARING',
  'MOBILITY_IMPACT',
  'DIPLOMATIC',
  'MACARON_SYSTEM',
  'OTHER'
);

-- CreateTable: sources surveillées
CREATE TABLE "G7Source" (
  "id"          TEXT         NOT NULL,
  "url"         VARCHAR(500) NOT NULL,
  "label"       VARCHAR(200) NOT NULL,
  "category"    VARCHAR(50)  NOT NULL,
  "active"      BOOLEAN      NOT NULL DEFAULT true,
  "lastChecked" TIMESTAMPTZ,
  "lastHash"    VARCHAR(64),
  "lastStatus"  INTEGER,
  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "G7Source_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "G7Source_url_key" ON "G7Source"("url");
CREATE INDEX "G7Source_active_idx" ON "G7Source"("active");

-- CreateTable: directives officielles connues
CREATE TABLE "G7Directive" (
  "id"          TEXT                   NOT NULL,
  "publishedAt" TIMESTAMPTZ            NOT NULL,
  "authority"   VARCHAR(100)           NOT NULL,
  "category"    "G7DirectiveCategory"  NOT NULL,
  "title"       VARCHAR(500)           NOT NULL,
  "summary"     TEXT                   NOT NULL,
  "url"         VARCHAR(500),
  "severity"    "Severity"             NOT NULL DEFAULT 'MEDIUM',
  "impact"      TEXT[]                 NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "G7Directive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "G7Directive_publishedAt_idx" ON "G7Directive"("publishedAt");
CREATE INDEX "G7Directive_category_idx"    ON "G7Directive"("category");

-- CreateTable: alertes de changement détectées par la veille
CREATE TABLE "G7WatchAlert" (
  "id"         TEXT         NOT NULL,
  "sourceId"   TEXT         NOT NULL,
  "detectedAt" TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "summary"    VARCHAR(1000) NOT NULL,
  "newHash"    VARCHAR(64)  NOT NULL,
  "oldHash"    VARCHAR(64),
  CONSTRAINT "G7WatchAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "G7WatchAlert_detectedAt_idx" ON "G7WatchAlert"("detectedAt");
CREATE INDEX "G7WatchAlert_sourceId_idx"   ON "G7WatchAlert"("sourceId");

ALTER TABLE "G7WatchAlert"
  ADD CONSTRAINT "G7WatchAlert_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "G7Source"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
