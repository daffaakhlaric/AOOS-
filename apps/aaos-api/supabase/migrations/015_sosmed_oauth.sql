-- AAOS-SOSMED-AUTOMATION Phase 4 -- 015_sosmed_oauth.sql
-- Backs `modules/sosmed`'s real OAuth flows (official-account connect + sales personal-account
-- connect-link). Same convention as 001-014: snake_case columns, `gen_random_uuid()` primary
-- keys, `TIMESTAMPTZ` timestamps, lives in apps/aaos-api's own migration folder.
--
-- Security-relevant judgment call (see coordinator note point 2 on
-- docs/PROMPT-AAOS-SOSMED-AUTOMATION.md, and SosmedConnectTokenRepository's own doc for the full
-- reasoning): the "generate connect link for a sales human" flow is a genuinely new public attack
-- surface -- a leaked link, before it is used, would let anyone connect an account AS that sales
-- human. This table is deliberately a real, durable, single-use, expiring token record (never a
-- bare UUID with no expiry/use tracking):
--   - `expires_at` -- the link stops being redeemable after a bounded window (see
--     `SosmedOAuthService.CONNECT_LINK_TTL_HOURS`), even if never clicked.
--   - `used_at` -- set ONLY after a successful OAuth token exchange completes (never on link
--     creation, never on merely starting the OAuth redirect) -- a failed/abandoned OAuth attempt
--     must not burn the link, per the spec's explicit requirement.
--   - `sales_human_id` -- ties the token to exactly one sales human; the resulting
--     `sosmed_accounts` row can only ever be attributed to that id, never an arbitrary one supplied
--     by the client at callback time.
--
-- `token` is NOT the primary key on purpose -- it is a long, high-entropy, single-use secret
-- (32 random bytes, hex-encoded -- see `SosmedConnectTokenRepository`), looked up by a unique
-- index the same way a password-reset/session token is, standard practice for this class of
-- credential (DB-index lookup, not a static-secret timing-attack surface like `ApiKeyGuard`'s
-- single shared `x-api-key`, which is why no `timingSafeEqual` discipline is needed here).
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- any later-phase `modules/sosmed` OAuth code can persist/read real data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE sosmed_connect_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL DEFAULT 'dss-motor',
  token             TEXT NOT NULL UNIQUE,
  sales_human_id    UUID NOT NULL REFERENCES sales_humans(id),
  expires_at        TIMESTAMPTZ NOT NULL,
  used_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_sosmed_connect_tokens_token ON sosmed_connect_tokens(token);
CREATE INDEX idx_sosmed_connect_tokens_sales_human ON sosmed_connect_tokens(sales_human_id);
