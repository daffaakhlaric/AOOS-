-- Atomic campaign draft -> immutable brief revision -> one Kai project.
-- Existing creative_packages and historical failures are deliberately untouched.
BEGIN;

CREATE TABLE public.campaign_creative_drafts (
  tenant_id text NOT NULL,
  id uuid NOT NULL,
  listing_id uuid NOT NULL,
  data jsonb NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  status text NOT NULL CHECK (status IN ('READY', 'NEEDS_INPUT')),
  missing_fields text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE public.structured_creative_briefs (
  tenant_id text NOT NULL,
  id uuid NOT NULL,
  campaign_draft_id uuid NOT NULL,
  content_hash text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, campaign_draft_id, content_hash),
  FOREIGN KEY (tenant_id, campaign_draft_id) REFERENCES public.campaign_creative_drafts(tenant_id,id)
);

CREATE TABLE public.kai_projects (
  tenant_id text NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_draft_id uuid NOT NULL,
  creative_brief_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'BRIEF_READY' CHECK (status IN ('BRIEF_READY', 'NEEDS_INPUT', 'IN_PRODUCTION', 'READY_FOR_CAMPAIGN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, campaign_draft_id),
  FOREIGN KEY (tenant_id, campaign_draft_id) REFERENCES public.campaign_creative_drafts(tenant_id,id),
  FOREIGN KEY (tenant_id, creative_brief_id) REFERENCES public.structured_creative_briefs(tenant_id,id)
);

ALTER TABLE public.campaign_creative_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structured_creative_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kai_projects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campaign_creative_drafts, public.structured_creative_briefs, public.kai_projects FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.campaign_creative_drafts, public.kai_projects TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.structured_creative_briefs FROM service_role;
GRANT SELECT, INSERT ON public.structured_creative_briefs TO service_role;

-- Invoker security plus service-role-only execution. Tenant comes from authenticated API context.
-- Advisory transaction lock also serializes the first insert when no draft row exists yet.
CREATE FUNCTION public.save_campaign_creative_handoff(
  p_tenant text, p_id uuid, p_listing uuid, p_data jsonb, p_revision integer,
  p_brief jsonb, p_hash text, p_missing text[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  current_draft public.campaign_creative_drafts;
  project public.kai_projects;
  brief_id uuid;
  next_revision integer;
BEGIN
  IF p_tenant IS NULL OR length(p_tenant) = 0 THEN RAISE EXCEPTION 'TENANT_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant || ':' || p_id::text, 0));
  SELECT * INTO current_draft FROM public.campaign_creative_drafts WHERE tenant_id=p_tenant AND id=p_id;
  IF current_draft.id IS NOT NULL AND current_draft.listing_id <> p_listing THEN
    RAISE EXCEPTION 'DRAFT_LISTING_IMMUTABLE' USING ERRCODE='22023';
  END IF;
  IF coalesce(current_draft.revision, 0) <> p_revision THEN
    -- Identical retries (including a lost first response) return the committed row.
    IF current_draft.data IS DISTINCT FROM p_data OR current_draft.missing_fields IS DISTINCT FROM p_missing THEN
      RAISE EXCEPTION 'DRAFT_REVISION_CONFLICT' USING ERRCODE='40001';
    END IF;
    SELECT * INTO project FROM public.kai_projects WHERE tenant_id=p_tenant AND campaign_draft_id=p_id;
    IF p_brief IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.structured_creative_briefs WHERE tenant_id=p_tenant AND id=project.creative_brief_id AND content_hash=p_hash
    ) THEN RAISE EXCEPTION 'DRAFT_REVISION_CONFLICT' USING ERRCODE='40001'; END IF;
    RETURN jsonb_build_object('draft', to_jsonb(current_draft), 'project', CASE WHEN project.id IS NULL THEN NULL ELSE to_jsonb(project) END);
  END IF;
  IF p_brief IS NOT NULL AND (
    p_brief->>'tenantId' IS DISTINCT FROM p_tenant OR
    p_brief->>'campaignDraftId' IS DISTINCT FROM p_id::text OR
    p_brief->>'listingId' IS DISTINCT FROM p_listing::text OR
    p_hash IS NULL OR cardinality(p_missing) <> 0
  ) THEN RAISE EXCEPTION 'BRIEF_LINEAGE_MISMATCH' USING ERRCODE='22023'; END IF;
  next_revision := coalesce(current_draft.revision, 0) + 1;
  INSERT INTO public.campaign_creative_drafts (tenant_id,id,listing_id,data,revision,status,missing_fields)
  VALUES(p_tenant,p_id,p_listing,p_data,next_revision,CASE WHEN p_brief IS NULL THEN 'NEEDS_INPUT' ELSE 'READY' END,p_missing)
  ON CONFLICT(tenant_id,id) DO UPDATE SET data=EXCLUDED.data, revision=EXCLUDED.revision,
    status=EXCLUDED.status, missing_fields=EXCLUDED.missing_fields, updated_at=now()
  RETURNING * INTO current_draft;
  IF p_brief IS NOT NULL THEN
    INSERT INTO public.structured_creative_briefs(tenant_id,id,campaign_draft_id,content_hash,data)
    VALUES(p_tenant,(p_brief->>'briefId')::uuid,p_id,p_hash,p_brief)
    ON CONFLICT(tenant_id,campaign_draft_id,content_hash) DO NOTHING;
    SELECT id INTO brief_id FROM public.structured_creative_briefs
      WHERE tenant_id=p_tenant AND campaign_draft_id=p_id AND content_hash=p_hash;
    INSERT INTO public.kai_projects(tenant_id,campaign_draft_id,creative_brief_id)
    VALUES(p_tenant,p_id,brief_id)
    ON CONFLICT(tenant_id,campaign_draft_id) DO UPDATE SET
      creative_brief_id=EXCLUDED.creative_brief_id,
      status=CASE WHEN kai_projects.creative_brief_id<>EXCLUDED.creative_brief_id OR kai_projects.status='NEEDS_INPUT' THEN 'BRIEF_READY' ELSE kai_projects.status END,
      updated_at=now()
    RETURNING * INTO project;
  ELSE
    UPDATE public.kai_projects SET status='NEEDS_INPUT',updated_at=now()
      WHERE tenant_id=p_tenant AND campaign_draft_id=p_id RETURNING * INTO project;
  END IF;
  RETURN jsonb_build_object('draft',to_jsonb(current_draft),'project',CASE WHEN project.id IS NULL THEN NULL ELSE to_jsonb(project) END);
END;
$$;
REVOKE ALL ON FUNCTION public.save_campaign_creative_handoff(text,uuid,uuid,jsonb,integer,jsonb,text,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_campaign_creative_handoff(text,uuid,uuid,jsonb,integer,jsonb,text,text[]) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
