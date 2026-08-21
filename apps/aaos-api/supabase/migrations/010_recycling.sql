-- AAOS-LEAD-RECYCLING-BROADCAST -- 010_recycling.sql
-- Backs `modules/recycling`'s RecyclingService/BroadcastTemplateRepository/BroadcastLogRepository/
-- RecyclingSettingsRepository. Applied against the SAME Supabase project every other AAOS table
-- lives in (see app.module.ts's `SUPABASE_CLIENT` wiring) -- same convention as 001-009:
-- snake_case columns, `gen_random_uuid()` primary keys, `TIMESTAMPTZ` timestamps.
--
-- These three tables live HERE (in apps/aaos-api's own migration folder), NOT in
-- packages/lead-store/supabase/migrations, even though `broadcast_logs.lead_id` FK-references
-- `leads(id)` (owned by @aos/lead-store's 001_initial_schema.sql, extended by that package's own
-- 005_recycling_fields.sql) -- per the coordinator note's section 1: these three tables are
-- conceptually owned by `RecyclingService`, the only thing that ever reads/writes them, exactly
-- like `calendar_events` (006) is owned by `SchedulerService` despite also living in this same
-- Supabase project as `leads`. No cross-database FK issue -- both migration folders target the
-- same project, this repo just applies each package/app's migrations independently (no single
-- unified runner spans both folders).
--
-- COLUMN-FOR-COLUMN CONTRACT with each repository's own `*Row` interface
-- (src/modules/recycling/infrastructure/*.ts). Any future column MUST be added there too.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `RecyclingService`'s endpoints can persist/read real data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Manager-authored/edited broadcast templates Jessy picks from (TAB 2).
CREATE TABLE broadcast_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL DEFAULT 'dss-motor',
  name            TEXT NOT NULL,
  content         TEXT NOT NULL,           -- isi pesan dengan {variabel}
  target_statuses TEXT[] NOT NULL,         -- e.g. ARRAY['WARM','COLD']
  cooldown_days   INTEGER NOT NULL DEFAULT 3,
  status          TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE'|'DRAFT'|'INACTIVE'
  reply_rate      NUMERIC(5,2) NOT NULL DEFAULT 0, -- % yang reply, recomputed from broadcast_logs
  hot_rate        NUMERIC(5,2) NOT NULL DEFAULT 0, -- % yang jadi HOT, recomputed from broadcast_logs
  sent_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per broadcast actually sent (TAB 3's Riwayat Broadcast).
CREATE TABLE broadcast_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT NOT NULL DEFAULT 'dss-motor',
  lead_id          UUID NOT NULL REFERENCES leads(id),
  template_id      UUID REFERENCES broadcast_templates(id),
  message_sent     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'SENT', -- 'SENT'|'DELIVERED'|'READ'|'FAILED'
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at     TIMESTAMPTZ,
  read_at          TIMESTAMPTZ,
  -- Set by the real reply-detection hook (coordinator note section 9) -- an honest incoming-
  -- message-after-broadcast signal, never a fabricated one.
  replied          BOOLEAN NOT NULL DEFAULT false,
  replied_at       TIMESTAMPTZ,
  -- Set only by a REAL, independently-happening lead status change to HOT (e.g. a sales human's
  -- own UpdateLeadStatus call) -- never set as a side effect of `replied` itself. See coordinator
  -- note section 9's explicit "never claim automatic re-qualification" decision.
  converted_to_hot BOOLEAN NOT NULL DEFAULT false,
  converted_at     TIMESTAMPTZ
);

CREATE INDEX idx_broadcast_logs_lead   ON broadcast_logs(lead_id);
CREATE INDEX idx_broadcast_logs_tenant ON broadcast_logs(tenant_id);
CREATE INDEX idx_broadcast_templates_tenant ON broadcast_templates(tenant_id);

-- Auto Mode flag (spec's "Toggle Auto Mode" — coordinator note section 8). A dedicated one-row-
-- per-tenant table rather than a new `tenants` column: `TenantRepository`/`TenantRow`
-- (superadmin module) has no generic settings/flags column to extend, and this flag is owned
-- entirely by `RecyclingService`, not the Super Admin panel.
CREATE TABLE recycling_settings (
  tenant_id  TEXT PRIMARY KEY,
  auto_mode  BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default row for the single tenant this app is composed for today (app.module.ts's
-- `AAOS_TENANT_ID` — coordinator note section 4: no multi-tenant loop exists here).
INSERT INTO recycling_settings (tenant_id, auto_mode) VALUES ('dss-motor', true);

-- Seed the daily RECYCLING_RUN Kalender event (coordinator note section 7) -- the REAL mechanism
-- driving auto-broadcast is `SchedulerService.checkAndRunDueEvents`'s existing generic
-- `calendar_events` due-window cron, not a second `@Cron`. Same seeding pattern as 006's own
-- 4 default rows.
INSERT INTO calendar_events
  (event_type, title, description, scheduled_at, recurrence, recurrence_days, recurrence_time, created_by)
VALUES
  ('RECYCLING_RUN', 'Auto Recycling Broadcast', 'Jessy kirim broadcast promo ke COLD & WARM leads',
   (CURRENT_DATE + TIME '09:00:00')::timestamptz, 'DAILY', NULL, '09:00', 'system');
