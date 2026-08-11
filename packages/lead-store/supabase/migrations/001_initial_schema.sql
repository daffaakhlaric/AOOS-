-- AAOS-W2E @aos/lead-store — 001_initial_schema.sql
-- Full CREATE TABLE statements, per docs/PROMPT-AAOS-W2E-LEAD-STORE.md "Supabase Schema".

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- sales_humans (created first — leads/assignments/closings reference it)
CREATE TABLE sales_humans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL DEFAULT 'dss-motor',
  name              TEXT NOT NULL,
  wa_number         TEXT NOT NULL,      -- +628xxx
  branch_id         TEXT NOT NULL,
  status            TEXT DEFAULT 'ON',  -- ON | BUSY | OFF
  max_leads_per_day INTEGER DEFAULT 10,
  auth_user_id      UUID,               -- Supabase Auth user ID
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- leads
CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL DEFAULT 'dss-motor',

  -- Source
  lead_source     TEXT NOT NULL,           -- CTWA | FORM | ORGANIC
  campaign_id     TEXT,                    -- Meta campaign #A001
  ad_id           TEXT,                    -- Meta ad #C047
  ad_account_id   TEXT,

  -- Contact
  lead_phone      TEXT NOT NULL,           -- +628xxx (E.164)
  lead_name       TEXT,                    -- extracted from conversation

  -- Branch
  branch_id       TEXT NOT NULL,           -- BINTARO | CINERE | UMUM | BANDUNG
  waba_phone_number_id TEXT NOT NULL,      -- which WABA received

  -- Status + Score
  status          TEXT NOT NULL DEFAULT 'NEW',  -- NEW|COLD|WARM|HOT|ASSIGNED|CLOSED
  score           INTEGER NOT NULL DEFAULT 0,   -- 0-100
  temperature     TEXT NOT NULL DEFAULT 'COLD', -- COLD|WARM|HOT

  -- Qualification flags
  qual_budget     BOOLEAN DEFAULT FALSE,
  qual_unit       BOOLEAN DEFAULT FALSE,
  qual_area       BOOLEAN DEFAULT FALSE,
  qual_payment    BOOLEAN DEFAULT FALSE,
  qual_timeline   BOOLEAN DEFAULT FALSE,
  qual_name       BOOLEAN DEFAULT FALSE,

  -- Assignment
  assigned_sales_id   UUID REFERENCES sales_humans(id),
  assigned_at         TIMESTAMPTZ,
  assignment_mode     TEXT,                -- SMART_ASSIGN|ROUND_ROBIN|MANUAL

  -- Timestamps
  first_message_at    TIMESTAMPTZ,
  last_message_at     TIMESTAMPTZ,
  became_hot_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_branch ON leads(branch_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_phone ON leads(lead_phone);
CREATE INDEX idx_leads_sales ON leads(assigned_sales_id);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
-- Judgment call: supports CreateLead's idempotency check (design resolution #5) — "duplicate
-- phone + branch -> returns existing" is looked up via `WHERE lead_phone = ... AND branch_id = ...`,
-- so a composite index (not present in the spec's literal index list) makes that lookup efficient.
CREATE UNIQUE INDEX idx_leads_phone_branch ON leads(lead_phone, branch_id);

-- conversations
CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),
  branch_id       TEXT NOT NULL,
  waba_phone_number_id TEXT NOT NULL,

  -- Stats
  message_count   INTEGER DEFAULT 0,
  -- Judgment call: `incoming_count`/`outgoing_count` are not in the spec's literal column list,
  -- but are required to implement the dN_count milestone algorithm exactly as pinned in the spec
  -- ("message 1 in, 1 out -> d1=1") — see @aos/lead-store's SaveMessage.ts docstring
  -- (design resolution #1) for the exact exchange-pairing rule: exchangeCount = min(incoming, outgoing).
  incoming_count  INTEGER DEFAULT 0,
  outgoing_count  INTEGER DEFAULT 0,
  d1_count        INTEGER DEFAULT 0,   -- total exchanges
  d2_count        INTEGER DEFAULT 0,
  d3_count        INTEGER DEFAULT 0,   -- 3 exchanges = primary metric
  d5_count        INTEGER DEFAULT 0,

  -- Jessy state
  current_stage   TEXT DEFAULT 'GREETING',
  last_intent     TEXT,

  started_at      TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  status          TEXT DEFAULT 'ACTIVE'  -- ACTIVE | CLOSED
);

CREATE INDEX idx_conversations_lead ON conversations(lead_id);

-- messages
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  lead_id         UUID NOT NULL REFERENCES leads(id),

  -- Direction
  direction       TEXT NOT NULL,  -- INCOMING | OUTGOING
  message_type    TEXT NOT NULL,  -- TEXT | TEMPLATE | INTERACTIVE | IMAGE

  -- Content
  body            TEXT,
  wamid           TEXT,           -- Meta message ID
  template_name   TEXT,

  -- Status (outgoing only)
  delivery_status TEXT,           -- SENT | DELIVERED | READ | FAILED

  -- Timestamps
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_lead ON messages(lead_id);

-- scoring_events
CREATE TABLE scoring_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),

  score_before    INTEGER NOT NULL,
  score_after     INTEGER NOT NULL,
  delta           INTEGER NOT NULL,   -- +25, -10, etc
  reason          TEXT NOT NULL,      -- BUDGET | UNIT | AREA | etc

  triggered_by    TEXT,               -- message_id or 'timeout'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scoring_events_lead ON scoring_events(lead_id);

-- assignments
CREATE TABLE assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),
  branch_id       TEXT NOT NULL,
  sales_human_id  UUID NOT NULL REFERENCES sales_humans(id),

  assignment_mode TEXT NOT NULL,
  assigned_at     TIMESTAMPTZ DEFAULT NOW(),
  released_at     TIMESTAMPTZ,        -- if reassigned
  status          TEXT DEFAULT 'ACTIVE'  -- ACTIVE | RELEASED
);

CREATE INDEX idx_assignments_lead ON assignments(lead_id);
CREATE INDEX idx_assignments_sales ON assignments(sales_human_id);

-- closings
CREATE TABLE closings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),
  sales_human_id  UUID NOT NULL REFERENCES sales_humans(id),
  branch_id       TEXT NOT NULL,

  closing_type    TEXT NOT NULL,      -- TEST_DRIVE | SPK | CANCELLED
  unit_id         TEXT,               -- from dss-inventory-connector
  unit_model      TEXT,               -- "Xpander Cross AT 2019"
  unit_price      BIGINT,             -- IDR

  -- Campaign attribution (for Tamara feed-back)
  campaign_id     TEXT,
  ad_id           TEXT,

  -- Financials
  commission_idr  BIGINT,
  commission_pct  NUMERIC(5,2),

  notes           TEXT,
  test_drive_at   TIMESTAMPTZ,
  spk_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_closings_branch ON closings(branch_id);
CREATE INDEX idx_closings_campaign ON closings(campaign_id);
CREATE INDEX idx_closings_created ON closings(created_at DESC);
