BEGIN;
-- Lock the same concept row as save_kai_storyboard, then check the reviewed revision.
CREATE OR REPLACE FUNCTION public.enqueue_kai_reviewed_jobs(
 p_tenant text, p_project uuid, p_concept_ids uuid[], p_revisions jsonb, p_mode text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE project public.kai_projects; selected_id uuid; revision integer;
BEGIN
 SELECT * INTO project FROM public.kai_projects WHERE tenant_id=p_tenant AND id=p_project FOR UPDATE;
 IF project.id IS NULL OR project.status='NEEDS_INPUT' THEN RAISE EXCEPTION 'BRIEF_NOT_READY' USING ERRCODE='22023'; END IF;
 IF p_mode IS NULL OR p_mode NOT IN ('FULL','SAMPLE') OR coalesce(array_length(p_concept_ids,1),0) NOT BETWEEN 1 AND 10
 OR (p_mode='SAMPLE' AND array_length(p_concept_ids,1)<>1) THEN RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE='22023'; END IF;
 FOR selected_id IN SELECT DISTINCT unnest(p_concept_ids) ORDER BY 1 LOOP
  PERFORM 1 FROM public.kai_concepts c WHERE c.tenant_id=p_tenant AND c.id=selected_id AND c.project_id=p_project AND c.brief_id=project.creative_brief_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONCEPT_NOT_IN_PROJECT' USING ERRCODE='22023'; END IF;
  SELECT b.revision INTO revision FROM public.kai_storyboards b WHERE b.tenant_id=p_tenant AND b.concept_id=selected_id ORDER BY b.revision DESC LIMIT 1;
  IF revision IS NULL OR (p_revisions->>selected_id::text) IS DISTINCT FROM revision::text THEN
   RAISE EXCEPTION 'STORYBOARD_REVISION_CONFLICT' USING ERRCODE='40001';
  END IF;
 END LOOP;
 IF p_mode='SAMPLE' THEN RETURN public.enqueue_kai_sample_job(p_tenant,p_project,p_concept_ids[1]); END IF;
 RETURN public.enqueue_kai_generation_jobs(p_tenant,p_project,p_concept_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_kai_reviewed_jobs(text,uuid,uuid[],jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_kai_reviewed_jobs(text,uuid,uuid[],jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
