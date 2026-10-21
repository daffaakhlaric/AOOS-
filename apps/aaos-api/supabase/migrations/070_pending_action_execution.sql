-- Claims are durable: never automatically replay an interrupted external mutation.
ALTER TABLE pending_agent_actions DROP CONSTRAINT IF EXISTS pending_agent_actions_status_check;
ALTER TABLE pending_agent_actions ADD CONSTRAINT pending_agent_actions_status_check
  CHECK (status IN ('PENDING','EXECUTING','REJECTING','APPROVED','REJECTED','EXECUTION_UNCERTAIN'));
