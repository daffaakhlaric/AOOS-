-- AAOS-CREATIVE-REVIEW -- 003_creative_packages.sql
-- Durable persistence for `modules/creative-packages`, REPLACING the process-local in-memory
-- `CreativePackageStore` (2 hardcoded `cdn.example.com` seed packages, lost on every restart,
-- never shared across replicas, never connected to any real generation pipeline).
--
-- Same shape convention as 001_simulations.sql / 002_scrape_jobs.sql -- snake_case columns,
-- `gen_random_uuid()` primary keys, `tenant_id TEXT NOT NULL DEFAULT 'dss-motor'`,
-- `TIMESTAMPTZ DEFAULT NOW()` timestamps, JSONB for the low-volume list/blob fields -- applied
-- against the SAME Supabase project every other AAOS table lives in (see app.module.ts's
-- `SUPABASE_CLIENT` wiring).
--
-- COLUMN-FOR-COLUMN CONTRACT with `CreativePackageRow` in
-- src/modules/creative-packages/infrastructure/creative-package.repository.ts. Any future column
-- MUST be added there in the same change.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `GET/POST /api/v1/creative-packages` can read or persist real rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE creative_packages (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                TEXT NOT NULL DEFAULT 'dss-motor',

  -- The real `CreativeBrief` this package was generated from. `brief_id` is the
  -- `CreativeBriefId` (a UUID) handed to `@aos/creative-agent`'s `ProcessCreativeBrief`.
  brief_id                 TEXT NOT NULL,
  -- Set only when the brief came from a Tamara REFRESH verdict on a real ad (origin='TAMARA').
  -- `stable_id` is the dashboard-facing `#C047`-style id `StableIdAssigner` already computes.
  ad_id                    TEXT,
  stable_id                TEXT,

  -- Real brief fields, recorded verbatim so the review queue can show WHAT was asked for without
  -- re-deriving it. `angle` is an `AdAngle` member, `branch` a `Branch` member, `urgency` a
  -- `CreativeUrgency` member -- all validated by Zod before insert, never free text from the UI.
  branch                   TEXT NOT NULL,
  unit                     TEXT NOT NULL,   -- the scraped unit's `identityKey` (assets.unit_id)
  unit_model               TEXT,            -- human-readable model, for display only
  title                    TEXT NOT NULL,
  angle                    TEXT NOT NULL,
  -- `TargetPersona` member (PRIMARY_FAMILY | SECONDARY_BUSINESS) -- a required `CreativeBrief`
  -- field, persisted so re-running/retrying a brief uses the same real value the manager chose.
  target_persona           TEXT NOT NULL DEFAULT 'PRIMARY_FAMILY',
  -- Why this creative is being made. Free text from the manager for a MANUAL brief; Tamara's real
  -- REFRESH reason for a TAMARA one. Required non-empty by `CreativeBrief.create`.
  reason                   TEXT NOT NULL,
  -- What the MANAGER asked for: 'VIDEO_AND_IMAGES' | 'IMAGES_ONLY' (@aos/creative-agent's real
  -- `CreativeFormat`). Kai may still DOWNGRADE to IMAGES_ONLY when a unit has no source photos --
  -- that real outcome lands in `decided_format`, which is why the two are separate columns.
  requested_format         TEXT NOT NULL,
  decided_format           TEXT,
  primary_message          TEXT NOT NULL,
  urgency                  TEXT NOT NULL DEFAULT 'MEDIUM',
  -- 'MANUAL' (Tab "Buat Manual") | 'TAMARA' (Tab "Rekomendasi Tamara", approved by a human).
  -- There is deliberately no third "auto" origin: nothing in this system generates without a
  -- human approving that specific brief first.
  origin                   TEXT NOT NULL DEFAULT 'MANUAL',

  -- DRAFT      -> saved, never sent to Kai (no Kie AI spend)
  -- GENERATING -> a human pressed "Kirim ke Kai"; the real pipeline is running
  -- PENDING    -> generation succeeded, awaiting manager review
  -- APPROVED / REJECTED -> reviewed (terminal)
  -- FAILED     -> the real pipeline errored; `error_message` says how
  status                   TEXT NOT NULL DEFAULT 'DRAFT',

  -- Real `@aos/asset-library` public URLs of the SOURCE unit photos found for `unit` at the moment
  -- generation started (the same `GetAssetsByUnit` query Kai itself runs). Empty array is a real,
  -- meaningful state: no scraped photos for this unit, so Kai generated text-to-video/image.
  source_photo_urls        JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Real generated output, persisted by `@aos/asset-library`'s `SaveAiCreative` (GCS-backed public
  -- URLs). NULL/empty until generation actually completes.
  video_url                TEXT,
  image_urls               JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- `CopyVariant[]` as {id,variantLabel,primaryText,headline,callToAction} -- real Kai output.
  copy_variants            JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- The real Kie AI model string `KaiAgentService` reports (e.g. 'veo3_fast+nano-banana-pro').
  ai_model                 TEXT,
  -- Kai's real `ConfidenceScore` for the delivered package (0..1). NULL until generated.
  confidence_score         NUMERIC,
  generation_ms            INTEGER,

  selected_copy_variant_id TEXT,
  error_message            TEXT,

  generated_at             TIMESTAMPTZ,
  reviewed_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_creative_packages_tenant ON creative_packages(tenant_id);
CREATE INDEX idx_creative_packages_status ON creative_packages(status);
CREATE INDEX idx_creative_packages_created ON creative_packages(created_at DESC);
