-- Phase 4: execution ledger, linked to the existing approval queue (070).
-- No existing approvals or creation requests are replayed/backfilled automatically.
BEGIN;
CREATE TABLE IF NOT EXISTS action_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  pending_action_id uuid REFERENCES pending_agent_actions(id),
  revision integer NOT NULL CHECK (revision > 0),
  supersedes_id uuid,
  command jsonb NOT NULL CHECK (jsonb_typeof(command) = 'object'),
  command_hash text NOT NULL CHECK (length(command_hash) = 64),
  state text NOT NULL DEFAULT 'AWAITING_APPROVAL' CHECK (state IN
    ('PROPOSED','AWAITING_APPROVAL','APPROVED','CLAIMED','EXECUTING','PARTIAL','VERIFYING',
     'VERIFIED','FAILED','UNCERTAIN','RECONCILING','ROLLED_BACK','CANCELLED','SUPERSEDED')),
  approved_by text,
  approved_at timestamptz,
  approval_hash text,
  claim_token uuid,
  claimed_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id),
  UNIQUE (tenant_id,pending_action_id,revision),
  FOREIGN KEY (tenant_id,supersedes_id) REFERENCES action_executions(tenant_id,id),
  CHECK (command->>'tenantId' = tenant_id),
  CHECK (command->>'actionId' = id::text),
  CHECK ((command->>'revision')::integer = revision)
);
CREATE TABLE IF NOT EXISTS action_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  action_id uuid NOT NULL,
  step_key text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  intent jsonb NOT NULL,
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN
    ('PENDING','SUBMITTING','VERIFYING','VERIFIED','FAILED','UNCERTAIN')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  provider_object_id text,
  receipt jsonb,
  verification jsonb,
  error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,action_id) REFERENCES action_executions(tenant_id,id),
  UNIQUE (action_id,step_key),
  UNIQUE (action_id,ordinal)
);
CREATE INDEX IF NOT EXISTS action_execution_recovery ON action_executions(state,updated_at);
CREATE INDEX IF NOT EXISTS action_execution_tenant ON action_executions(tenant_id,created_at DESC);
ALTER TABLE action_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON action_executions, action_steps FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON action_executions, action_steps TO service_role;

CREATE OR REPLACE FUNCTION protect_action_command() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.command IS DISTINCT FROM OLD.command OR NEW.command_hash IS DISTINCT FROM OLD.command_hash
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.revision IS DISTINCT FROM OLD.revision OR NEW.pending_action_id IS DISTINCT FROM OLD.pending_action_id
    OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
  ) THEN RAISE EXCEPTION 'IMMUTABLE_ACTION_COMMAND'; END IF;
  IF NEW.command->>'tenantId' IS DISTINCT FROM NEW.tenant_id
    OR NEW.command->>'actionId' IS DISTINCT FROM NEW.id::text
    OR NEW.command->>'revision' IS DISTINCT FROM NEW.revision::text
    THEN RAISE EXCEPTION 'ACTION_IDENTITY_MISMATCH'; END IF;
  IF NEW.pending_action_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pending_agent_actions WHERE id=NEW.pending_action_id AND tenant_id=NEW.tenant_id
  ) THEN RAISE EXCEPTION 'APPROVAL_TENANT_MISMATCH'; END IF;
  IF NEW.state IN ('APPROVED','CLAIMED','EXECUTING','VERIFYING','VERIFIED','PARTIAL','UNCERTAIN','RECONCILING')
    AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL OR NEW.approval_hash IS DISTINCT FROM NEW.command_hash)
    THEN RAISE EXCEPTION 'APPROVAL_REQUIRED'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS action_command_immutable ON action_executions;
CREATE TRIGGER action_command_immutable BEFORE INSERT OR UPDATE ON action_executions
FOR EACH ROW EXECUTE FUNCTION protect_action_command();

CREATE OR REPLACE FUNCTION protect_action_step() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.intent IS DISTINCT FROM OLD.intent OR NEW.action_id IS DISTINCT FROM OLD.action_id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.step_key IS DISTINCT FROM OLD.step_key
    OR NEW.ordinal IS DISTINCT FROM OLD.ordinal OR NEW.id IS DISTINCT FROM OLD.id
    THEN RAISE EXCEPTION 'IMMUTABLE_STEP_INTENT'; END IF;
  IF OLD.provider_object_id IS NOT NULL AND NEW.provider_object_id IS DISTINCT FROM OLD.provider_object_id
    THEN RAISE EXCEPTION 'PROVIDER_ID_IMMUTABLE'; END IF;
  IF OLD.state IN ('SUBMITTING','VERIFYING','VERIFIED','UNCERTAIN') AND NEW.state='PENDING'
    THEN RAISE EXCEPTION 'UNSAFE_STEP_REPLAY'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS action_step_immutable ON action_steps;
CREATE TRIGGER action_step_immutable BEFORE UPDATE ON action_steps
FOR EACH ROW EXECUTE FUNCTION protect_action_step();
COMMIT;
