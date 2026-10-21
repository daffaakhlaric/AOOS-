-- Apply after 064. Durable production state; existing packages/assets remain the media inventory.
BEGIN;
CREATE TABLE public.kai_concepts (
  tenant_id text NOT NULL, id uuid NOT NULL, project_id uuid NOT NULL, brief_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK(ordinal >= 0), data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,project_id,brief_id,ordinal),
  FOREIGN KEY(tenant_id,project_id) REFERENCES public.kai_projects(tenant_id,id),
  FOREIGN KEY(tenant_id,brief_id) REFERENCES public.structured_creative_briefs(tenant_id,id)
);
CREATE TABLE public.kai_storyboards (
  tenant_id text NOT NULL, id uuid NOT NULL, concept_id uuid NOT NULL,
  revision integer NOT NULL CHECK(revision > 0), data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,concept_id,revision),
  FOREIGN KEY(tenant_id,concept_id) REFERENCES public.kai_concepts(tenant_id,id)
);
CREATE TABLE public.kai_generation_jobs (
  tenant_id text NOT NULL, id uuid NOT NULL, project_id uuid NOT NULL, concept_id uuid NOT NULL,
  brief_id uuid NOT NULL, storyboard_id uuid NOT NULL, idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','SUBMITTING','RUNNING','INGESTING','QA','READY','QA_FAILED','FAILED','CANCELLED')),
  provider_task_id text, model text NOT NULL, format text NOT NULL CHECK(format IN('IMAGE','VIDEO','CAROUSEL')),
  plan jsonb NOT NULL, output jsonb, error_code text, error_message text,
  attempt integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_owner uuid, lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,idempotency_key), UNIQUE(provider_task_id),
  FOREIGN KEY(tenant_id,project_id) REFERENCES public.kai_projects(tenant_id,id),
  FOREIGN KEY(tenant_id,concept_id) REFERENCES public.kai_concepts(tenant_id,id),
  FOREIGN KEY(tenant_id,brief_id) REFERENCES public.structured_creative_briefs(tenant_id,id),
  FOREIGN KEY(tenant_id,storyboard_id) REFERENCES public.kai_storyboards(tenant_id,id)
);
CREATE INDEX kai_jobs_due ON public.kai_generation_jobs(next_attempt_at) WHERE status IN('QUEUED','SUBMITTING','RUNNING','INGESTING','QA');
CREATE TABLE public.campaign_creative_selections (
  tenant_id text NOT NULL, campaign_draft_id uuid NOT NULL, job_id uuid NOT NULL,
  selected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,campaign_draft_id,job_id),
  FOREIGN KEY(tenant_id,campaign_draft_id) REFERENCES public.campaign_creative_drafts(tenant_id,id),
  FOREIGN KEY(tenant_id,job_id) REFERENCES public.kai_generation_jobs(tenant_id,id)
);
ALTER TABLE public.kai_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kai_storyboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kai_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_creative_selections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kai_concepts,public.kai_storyboards,public.kai_generation_jobs,public.campaign_creative_selections FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.kai_concepts,public.kai_storyboards,public.kai_generation_jobs,public.campaign_creative_selections TO service_role;

-- One concept set per immutable brief. Two requests cannot create duplicate concept/package sets.
CREATE FUNCTION public.ensure_kai_concepts(p_tenant text,p_project uuid,p_brief uuid,p_concepts jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE project public.kai_projects; item jsonb; concept_id uuid; result jsonb;
BEGIN
  SELECT * INTO project FROM public.kai_projects WHERE tenant_id=p_tenant AND id=p_project FOR UPDATE;
  IF project.id IS NULL OR project.creative_brief_id<>p_brief OR project.status='NEEDS_INPUT' THEN RAISE EXCEPTION 'BRIEF_NOT_READY' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.kai_concepts WHERE tenant_id=p_tenant AND project_id=p_project AND brief_id=p_brief) THEN
    IF jsonb_typeof(p_concepts)<>'array' OR jsonb_array_length(p_concepts) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'INVALID_CONCEPTS' USING ERRCODE='22023'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_concepts) LOOP
      concept_id := (item->>'id')::uuid;
      INSERT INTO public.kai_concepts(tenant_id,id,project_id,brief_id,ordinal,data)
        VALUES(p_tenant,concept_id,p_project,p_brief,(item->>'ordinal')::integer,item - 'storyboard');
      INSERT INTO public.creative_packages(id,tenant_id,brief_id,vertical,listing_id,title,angle,target_persona,requested_format,primary_message,reason,urgency,origin,source_photo_urls)
        SELECT concept_id,p_tenant,p_brief::text,'PROPERTY',data->>'listingId',item->>'title',item->>'legacyAngle',item->>'persona',
          CASE WHEN item->>'format'='VIDEO' THEN 'VIDEO_AND_IMAGES' ELSE 'IMAGES_ONLY' END,
          item->>'message',item->>'hypothesis','MEDIUM',data->>'createdBy',
          item->'sourceUrls'
        FROM public.structured_creative_briefs WHERE tenant_id=p_tenant AND id=p_brief;
      INSERT INTO public.kai_storyboards(tenant_id,id,concept_id,revision,data)
        VALUES(p_tenant,(item->'storyboard'->>'id')::uuid,concept_id,1,item->'storyboard');
    END LOOP;
  END IF;
  SELECT jsonb_agg(data ORDER BY ordinal) INTO result FROM public.kai_concepts WHERE tenant_id=p_tenant AND project_id=p_project AND brief_id=p_brief;
  RETURN coalesce(result,'[]'::jsonb);
END;
$$;

CREATE FUNCTION public.save_kai_storyboard(p_tenant text,p_concept uuid,p_expected integer,p_id uuid,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE current_revision integer; result public.kai_storyboards;
BEGIN
  PERFORM 1 FROM public.kai_concepts c JOIN public.kai_projects p ON p.tenant_id=c.tenant_id AND p.id=c.project_id
    WHERE c.tenant_id=p_tenant AND c.id=p_concept AND p.creative_brief_id=c.brief_id AND p.status<>'NEEDS_INPUT' FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'BRIEF_NOT_READY' USING ERRCODE='22023'; END IF;
  SELECT coalesce(max(revision),0) INTO current_revision FROM public.kai_storyboards WHERE tenant_id=p_tenant AND concept_id=p_concept;
  IF current_revision<>p_expected THEN RAISE EXCEPTION 'STORYBOARD_REVISION_CONFLICT' USING ERRCODE='40001'; END IF;
  INSERT INTO public.kai_storyboards(tenant_id,id,concept_id,revision,data) VALUES(p_tenant,p_id,p_concept,current_revision+1,p_data) RETURNING * INTO result;
  RETURN to_jsonb(result);
END;
$$;

-- Lease claim is atomic across replicas. Expired SUBMITTING jobs must not resubmit blindly:
-- provider may have accepted the request without returning its ID before the process died.
CREATE FUNCTION public.claim_kai_generation_job(p_worker uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE job public.kai_generation_jobs;
BEGIN
  SELECT * INTO job FROM public.kai_generation_jobs
    WHERE status IN('QUEUED','SUBMITTING','RUNNING','INGESTING','QA') AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now())
    ORDER BY next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF job.id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.kai_generation_jobs SET lease_owner=p_worker,lease_until=now()+interval '120 seconds',updated_at=now()
    WHERE tenant_id=job.tenant_id AND id=job.id RETURNING * INTO job;
  RETURN to_jsonb(job);
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_kai_concepts(text,uuid,uuid,jsonb),public.save_kai_storyboard(text,uuid,integer,uuid,jsonb),public.claim_kai_generation_job(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_kai_concepts(text,uuid,uuid,jsonb),public.save_kai_storyboard(text,uuid,integer,uuid,jsonb),public.claim_kai_generation_job(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
