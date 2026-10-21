-- Completes early deployments of migration 067. Safe to run again.
BEGIN;
ALTER TABLE public.loop_runs ADD COLUMN IF NOT EXISTS trigger_contract jsonb;
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
REVOKE ALL ON FUNCTION public.claim_advertising_loop(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_advertising_loop(text,uuid,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

