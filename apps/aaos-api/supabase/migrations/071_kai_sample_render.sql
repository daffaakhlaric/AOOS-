BEGIN;
ALTER TABLE public.kai_generation_jobs DROP CONSTRAINT IF EXISTS kai_generation_jobs_status_check;
ALTER TABLE public.kai_generation_jobs ADD CONSTRAINT kai_generation_jobs_status_check
 CHECK(status IN('QUEUED','SUBMITTING','RUNNING','INGESTING','QA','READY','SAMPLE_READY','QA_FAILED','FAILED','CANCELLED'));
ALTER TABLE public.kai_generation_jobs DROP CONSTRAINT IF EXISTS kai_sample_not_publishable;
ALTER TABLE public.kai_generation_jobs ADD CONSTRAINT kai_sample_not_publishable
 CHECK(coalesce(plan->>'renderMode','FULL') <> 'SAMPLE' OR status <> 'READY');

CREATE OR REPLACE FUNCTION public.enqueue_kai_sample_job(p_tenant text,p_project uuid,p_concept uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE project public.kai_projects; concept public.kai_concepts; board public.kai_storyboards; job public.kai_generation_jobs; key text;
BEGIN
 SELECT * INTO project FROM public.kai_projects WHERE tenant_id=p_tenant AND id=p_project FOR UPDATE;
 IF project.id IS NULL OR project.status='NEEDS_INPUT' THEN RAISE EXCEPTION 'BRIEF_NOT_READY' USING ERRCODE='22023'; END IF;
 SELECT * INTO concept FROM public.kai_concepts WHERE tenant_id=p_tenant AND id=p_concept AND project_id=p_project AND brief_id=project.creative_brief_id;
 IF concept.id IS NULL THEN RAISE EXCEPTION 'CONCEPT_NOT_IN_PROJECT' USING ERRCODE='22023'; END IF;
 SELECT * INTO board FROM public.kai_storyboards WHERE tenant_id=p_tenant AND concept_id=p_concept ORDER BY revision DESC LIMIT 1;
 IF board.id IS NULL THEN RAISE EXCEPTION 'STORYBOARD_REQUIRED' USING ERRCODE='22023'; END IF;
 key := p_tenant || ':' || p_concept::text || ':storyboard:' || board.revision::text || ':sample';
 INSERT INTO public.kai_generation_jobs(tenant_id,id,project_id,concept_id,brief_id,storyboard_id,idempotency_key,model,format,plan)
 VALUES(p_tenant,gen_random_uuid(),p_project,p_concept,project.creative_brief_id,board.id,key,
 CASE WHEN concept.data->>'format'='VIDEO' THEN 'veo3_fast' ELSE 'nano-banana-pro' END,
 concept.data->>'format',board.data || '{"renderMode":"SAMPLE"}'::jsonb)
 ON CONFLICT(tenant_id,idempotency_key) DO NOTHING RETURNING * INTO job;
 IF job.id IS NULL THEN SELECT * INTO job FROM public.kai_generation_jobs WHERE tenant_id=p_tenant AND idempotency_key=key; END IF;
 RETURN to_jsonb(job);
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_kai_sample_job(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_kai_sample_job(text,uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
