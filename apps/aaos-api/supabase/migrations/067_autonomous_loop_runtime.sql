-- Phase 1: durable runtime around the EXISTING calendar scheduler. No autonomy upgrade.
BEGIN;
ALTER TABLE public.loop_runs ALTER COLUMN completed_at DROP NOT NULL;
ALTER TABLE public.loop_runs ALTER COLUMN duration_ms DROP NOT NULL;
ALTER TABLE public.loop_runs ADD COLUMN IF NOT EXISTS correlation_id uuid;
ALTER TABLE public.loop_runs ADD COLUMN IF NOT EXISTS trigger_event_id uuid;
ALTER TABLE public.loop_runs ADD COLUMN IF NOT EXISTS trigger_type text;
ALTER TABLE public.loop_runs ADD COLUMN IF NOT EXISTS trigger_contract jsonb;
ALTER TABLE public.loop_runs ADD COLUMN IF NOT EXISTS current_stage text NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE public.loop_runs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE public.loop_runs ADD COLUMN IF NOT EXISTS lease_owner uuid;
ALTER TABLE public.loop_runs ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE public.loop_runs ADD COLUMN IF NOT EXISTS error_code text;
ALTER TABLE public.loop_runs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.loop_runs SET correlation_id=id WHERE correlation_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS loop_runs_trigger_event_unique ON public.loop_runs(tenant_id,trigger_event_id) WHERE trigger_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS loop_runs_active_lease ON public.loop_runs(lease_until) WHERE status='RUNNING';

CREATE OR REPLACE FUNCTION public.claim_advertising_loop(p_tenant text,p_event uuid,p_worker uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e calendar_events%ROWTYPE; r loop_runs%ROWTYPE; run_id uuid:=gen_random_uuid();
BEGIN
  SELECT * INTO e FROM calendar_events WHERE id=p_event AND tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND OR e.status<>'PENDING' THEN RETURN NULL; END IF;
  -- A single event is a single execution. Manual reruns require a new calendar event.
  IF EXISTS(SELECT 1 FROM loop_runs WHERE tenant_id=p_tenant AND trigger_event_id=p_event) THEN RETURN NULL; END IF;
  INSERT INTO loop_runs(id,tenant_id,started_at,correlation_id,trigger_event_id,trigger_type,trigger_contract,current_stage,status,lease_owner,lease_until)
  VALUES(run_id,p_tenant,now(),run_id,p_event,e.event_type,jsonb_build_object(
    'type','scheduler.event.due.v1','version',1,'eventId',e.id,'tenantId',p_tenant,'entityId',coalesce(e.target_id,e.id::text),
    'correlationId',run_id,'occurredAt',e.scheduled_at,'payload',jsonb_build_object('calendarEventType',e.event_type)
  ),'OBSERVING','RUNNING',p_worker,now()+interval '5 minutes') RETURNING * INTO r;
  UPDATE calendar_events SET status='RUNNING',started_at=now() WHERE id=p_event AND tenant_id=p_tenant;
  RETURN to_jsonb(r)||jsonb_build_object('event',to_jsonb(e));
END $$;

CREATE OR REPLACE FUNCTION public.heartbeat_advertising_loop(p_tenant text,p_run uuid,p_worker uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE loop_runs SET lease_until=now()+interval '5 minutes',updated_at=now()
  WHERE id=p_run AND tenant_id=p_tenant AND lease_owner=p_worker AND status='RUNNING' AND lease_until>now();
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.finish_advertising_loop(p_tenant text,p_run uuid,p_worker uuid,p_success boolean,p_result jsonb,p_error text DEFAULT NULL,p_next timestamptz DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r loop_runs%ROWTYPE; e calendar_events%ROWTYPE;
BEGIN
  SELECT * INTO r FROM loop_runs WHERE id=p_run AND tenant_id=p_tenant AND lease_owner=p_worker AND status='RUNNING' AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO e FROM calendar_events WHERE id=r.trigger_event_id AND tenant_id=p_tenant AND status='RUNNING' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVENT_STATE_CHANGED'; END IF;
  UPDATE loop_runs SET status=CASE WHEN p_success THEN 'COMPLETED' ELSE 'FAILED' END,
    current_stage=CASE WHEN p_success THEN 'COMPLETED' ELSE 'FAILED' END,
    completed_at=now(),duration_ms=least(2147483647,extract(epoch FROM(now()-started_at))*1000)::integer,
    error_code=p_error,lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=r.id;
  UPDATE calendar_events SET status=CASE WHEN p_success THEN 'DONE' ELSE 'FAILED' END,
    completed_at=now(),duration_ms=least(2147483647,extract(epoch FROM(now()-r.started_at))*1000)::integer,
    result=p_result,error_message=p_error WHERE id=r.trigger_event_id AND tenant_id=p_tenant AND status='RUNNING';
  IF NOT FOUND THEN RAISE EXCEPTION 'EVENT_STATE_CHANGED'; END IF;
  IF p_success AND p_next IS NOT NULL THEN
    IF e.recurrence='ONCE' OR p_next<=now() THEN RAISE EXCEPTION 'INVALID_NEXT_REVIEW'; END IF;
    INSERT INTO calendar_events SELECT (jsonb_populate_record(NULL::calendar_events,to_jsonb(e)||jsonb_build_object(
      'id',gen_random_uuid(),'scheduled_at',p_next,'status','PENDING','started_at',NULL,'completed_at',NULL,
      'duration_ms',NULL,'result',NULL,'error_message',NULL,'created_by','system','parent_event_id',e.id,'created_at',now()
    ))).*;
  END IF;
  RETURN true;
END $$;

-- Uncertain execution is blocked, never automatically retried against a paid provider/Meta.
CREATE OR REPLACE FUNCTION public.reconcile_advertising_loops(p_tenant text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r loop_runs%ROWTYPE; n integer:=0;
BEGIN
  FOR r IN SELECT * FROM loop_runs WHERE tenant_id=p_tenant AND status='RUNNING' AND lease_until<=now() FOR UPDATE SKIP LOCKED LOOP
    UPDATE loop_runs SET status='BLOCKED',current_stage='BLOCKED',error_code='EXECUTION_UNCERTAIN',lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=r.id;
    UPDATE calendar_events SET status='FAILED',error_message='EXECUTION_UNCERTAIN: reconcile external state before retry' WHERE id=r.trigger_event_id AND tenant_id=p_tenant AND status='RUNNING';
    n:=n+1;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.claim_advertising_loop(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.heartbeat_advertising_loop(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_advertising_loop(text,uuid,uuid,boolean,jsonb,text,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reconcile_advertising_loops(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_advertising_loop(text,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_advertising_loop(text,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_advertising_loop(text,uuid,uuid,boolean,jsonb,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_advertising_loops(text) TO service_role;
COMMIT;
