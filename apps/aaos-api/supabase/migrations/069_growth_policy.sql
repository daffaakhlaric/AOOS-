-- Versioned tenant growth preferences. Service API validates roles and the full policy schema.
-- Saving schedules observation only; never calls Meta or changes existing campaign modes.
CREATE TABLE IF NOT EXISTS growth_policies (
  tenant_id text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  policy jsonb NOT NULL CHECK (jsonb_typeof(policy) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  changed_by text NOT NULL
);
CREATE TABLE IF NOT EXISTS growth_policy_versions (
  tenant_id text NOT NULL,
  version integer NOT NULL,
  before_policy jsonb,
  after_policy jsonb NOT NULL,
  changed_by text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, version)
);
ALTER TABLE growth_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_policy_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON growth_policies, growth_policy_versions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON growth_policies TO service_role;
GRANT SELECT, INSERT ON growth_policy_versions TO service_role;

CREATE OR REPLACE FUNCTION save_growth_policy(p_tenant text, p_expected integer, p_policy jsonb, p_actor text, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_row growth_policies%ROWTYPE; new_row growth_policies%ROWTYPE;
BEGIN
  IF p_tenant IS NULL OR length(trim(p_tenant)) = 0 OR p_actor IS NULL OR length(trim(p_actor)) = 0 THEN
    RAISE EXCEPTION 'GROWTH_POLICY_IDENTITY_REQUIRED';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('growth-policy:' || p_tenant, 0));
  SELECT * INTO old_row FROM growth_policies WHERE tenant_id = p_tenant FOR UPDATE;
  IF p_expected IS NULL OR p_expected <> coalesce(old_row.version, 0) THEN RAISE EXCEPTION 'STALE_POLICY'; END IF;
  INSERT INTO growth_policies (tenant_id, version, policy, changed_by)
    VALUES (p_tenant, coalesce(old_row.version, 0) + 1, p_policy, p_actor)
    ON CONFLICT (tenant_id) DO UPDATE SET version = EXCLUDED.version, policy = EXCLUDED.policy,
      changed_by = EXCLUDED.changed_by, updated_at = now()
    RETURNING * INTO new_row;
  INSERT INTO growth_policy_versions (tenant_id, version, before_policy, after_policy, changed_by, reason)
    VALUES (p_tenant, new_row.version, old_row.policy, p_policy, p_actor, p_reason);
  -- Existing scheduler is the durable outbox consumer. Re-evaluates, never executes on save.
  INSERT INTO calendar_events (tenant_id, event_type, title, scheduled_at, recurrence, status, created_by, metadata)
    VALUES (p_tenant, 'SAMANTHA_ANALYZE', 'Growth Strategy Updated', now(), 'ONCE', 'PENDING', p_actor,
      jsonb_build_object('eventType', 'growth.policy.updated', 'schemaVersion', 1, 'growthPolicyVersion', new_row.version));
  RETURN to_jsonb(new_row);
END;
$$;
REVOKE ALL ON FUNCTION save_growth_policy(text, integer, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION save_growth_policy(text, integer, jsonb, text, text) TO service_role;
NOTIFY pgrst, 'reload schema';
