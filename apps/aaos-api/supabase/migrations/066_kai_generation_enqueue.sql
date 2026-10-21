-- Apply after 065. Queues persisted concepts for provider work without calling a provider.
BEGIN;
CREATE FUNCTION public.enqueue_kai_generation_jobs(
  p_tenant text, p_project uuid, p_concept_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE project public.kai_projects; concept public.kai_concepts; board public.kai_storyboards; concept_id uuid;
  job public.kai_generation_jobs; result jsonb := '[]'::jsonb; slot_format text; model text; key text;
BEGIN
  SELECT * INTO project FROM public.kai_projects WHERE tenant_id=p_tenant AND id=p_project FOR UPDATE;
  IF project.id IS NULL OR project.status IN ('NEEDS_INPUT') THEN
    RAISE EXCEPTION 'BRIEF_NOT_READY' USING ERRCODE='22023';
  END IF;
  IF coalesce(array_length(p_concept_ids,1),0) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'INVALID_CONCEPTS' USING ERRCODE='22023';
  END IF;
  FOREACH concept_id IN ARRAY p_concept_ids LOOP
    SELECT c.* INTO concept FROM public.kai_concepts c WHERE c.tenant_id=p_tenant AND c.id=concept_id AND c.project_id=p_project AND c.brief_id=project.creative_brief_id;
    IF concept.id IS NULL THEN RAISE EXCEPTION 'CONCEPT_NOT_IN_PROJECT' USING ERRCODE='22023'; END IF;
    SELECT b.* INTO board FROM public.kai_storyboards b WHERE b.tenant_id=p_tenant AND b.concept_id=concept.id ORDER BY b.revision DESC LIMIT 1;
    IF board.id IS NULL THEN RAISE EXCEPTION 'STORYBOARD_REQUIRED' USING ERRCODE='22023'; END IF;
    slot_format := upper(coalesce(concept.data->>'format','IMAGE'));
    model := CASE WHEN slot_format='VIDEO' THEN 'veo3_fast' ELSE 'nano-banana-pro' END;
    key := p_tenant || ':' || concept.id::text || ':storyboard:' || board.revision::text;
    INSERT INTO public.kai_generation_jobs(tenant_id,id,project_id,concept_id,brief_id,storyboard_id,idempotency_key,model,format,plan)
      VALUES(p_tenant,gen_random_uuid(),p_project,concept.id,project.creative_brief_id,board.id,key,model,slot_format,board.data)
      ON CONFLICT (tenant_id,idempotency_key) DO NOTHING
      RETURNING * INTO job;
    IF job.id IS NULL THEN SELECT * INTO job FROM public.kai_generation_jobs WHERE tenant_id=p_tenant AND idempotency_key=key; END IF;
    result := result || jsonb_build_array(to_jsonb(job));
  END LOOP;
  UPDATE public.kai_projects SET status='IN_PRODUCTION', updated_at=now() WHERE tenant_id=p_tenant AND id=p_project;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_kai_generation_jobs(text,uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_kai_generation_jobs(text,uuid,uuid[]) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
