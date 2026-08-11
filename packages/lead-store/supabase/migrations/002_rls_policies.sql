-- AAOS-W2E @aos/lead-store — 002_rls_policies.sql
-- Row Level Security, per docs/PROMPT-AAOS-W2E-LEAD-STORE.md "Row Level Security (RLS)".

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_humans ENABLE ROW LEVEL SECURITY;

-- Sales human: hanya lihat leads cabang sendiri
CREATE POLICY "sales_view_own_branch_leads" ON leads
  FOR SELECT USING (
    branch_id = (
      SELECT branch_id FROM sales_humans
      WHERE auth_user_id = auth.uid()
    )
  );

-- Sales human: claim unassigned leads di cabang sendiri
CREATE POLICY "sales_claim_unassigned" ON leads
  FOR UPDATE USING (
    assigned_sales_id IS NULL
    AND branch_id = (
      SELECT branch_id FROM sales_humans
      WHERE auth_user_id = auth.uid()
    )
  );

-- Sales human: hanya lihat conversations/messages/closings cabang sendiri (mirrors the leads
-- policy — judgment call: the spec enables RLS on these 4 tables but only writes out the 2
-- `leads` policies explicitly; the remaining tables need at least one SELECT policy each so a
-- sales human's own branch data is reachable once RLS is ON, otherwise RLS defaults to
-- deny-all and even the service role's reads would need to bypass RLS entirely).
CREATE POLICY "sales_view_own_branch_conversations" ON conversations
  FOR SELECT USING (
    branch_id = (
      SELECT branch_id FROM sales_humans
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "sales_view_own_branch_messages" ON messages
  FOR SELECT USING (
    lead_id IN (
      SELECT id FROM leads
      WHERE branch_id = (
        SELECT branch_id FROM sales_humans
        WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "sales_view_own_branch_closings" ON closings
  FOR SELECT USING (
    branch_id = (
      SELECT branch_id FROM sales_humans
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "sales_insert_own_branch_closings" ON closings
  FOR INSERT WITH CHECK (
    branch_id = (
      SELECT branch_id FROM sales_humans
      WHERE auth_user_id = auth.uid()
    )
  );

-- Service role: full access (untuk backend AAOS)
-- Menggunakan SUPABASE_SERVICE_KEY di apps/aaos-api — the service role bypasses RLS entirely
-- by Postgres/Supabase default (BYPASSRLS on the service_role), so no explicit policy is needed
-- for @aos/lead-store's own writes; the policies above only govern direct end-user (anon/sales
-- human JWT) access from apps/aaos-crm.
