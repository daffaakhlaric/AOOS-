-- AAOS-W2E @aos/lead-store — 003_realtime.sql
-- Enable realtime, per docs/PROMPT-AAOS-W2E-LEAD-STORE.md "Supabase Realtime".

ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE closings;
