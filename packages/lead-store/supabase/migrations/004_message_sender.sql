-- AAOS-CHAT-ROOM-JESSY @aos/lead-store — 004_message_sender.sql
-- Per docs/PROMPT-AAOS-CHAT-ROOM-JESSY.md COORDINATOR NOTE #2: the real `messages` table has no
-- way to tell Jessy's own automated replies apart from a sales human's reply or a manager's
-- "intervene as Jessy" message (`direction` alone only distinguishes IN/OUT). Purely additive —
-- no existing column is touched.

ALTER TABLE messages ADD COLUMN sender_type TEXT; -- JESSY | SALES_HUMAN | MANAGER_INTERVENTION (NULL for INCOMING)
ALTER TABLE messages ADD COLUMN sender_name TEXT; -- populated for SALES_HUMAN / MANAGER_INTERVENTION, NULL otherwise

-- Backfill: every OUTGOING row that predates this migration was sent by Jessy's own automation
-- (this feature is the first thing that can ever produce a SALES_HUMAN/MANAGER_INTERVENTION row).
-- INCOMING rows are always from the lead — left NULL, per the entity/mapper's documented
-- convention (coordinator note #2: "no column needed for that case").
UPDATE messages SET sender_type = 'JESSY' WHERE direction = 'OUTGOING' AND sender_type IS NULL;

-- Coordinator note #3 — manager RLS: `002_rls_policies.sql`'s existing SELECT policies scope a
-- sales human to their own branch via `sales_humans.branch_id`. A dashboard MANAGER (role stored
-- in Supabase Auth `user_metadata.role`, per apps/aaos-dashboard's `lib/auth.ts`) has no
-- `sales_humans` row at all, so needs its own, additive policy rather than a change to the
-- existing sales ones. Realtime subscriptions run under the same RLS as a normal SELECT, so this
-- is what lets a manager's browser client (anon key, `apps/aaos-dashboard/src/lib/supabase.ts`)
-- subscribe to every branch's `messages`/`scoring_events`, not just one.
CREATE POLICY "manager_view_all_messages" ON messages
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
  );

CREATE POLICY "manager_view_all_scoring_events" ON scoring_events
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
  );
