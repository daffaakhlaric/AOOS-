-- Listing knowledge V1. Additive; apply to the existing Supabase project.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE UNIQUE INDEX IF NOT EXISTS listings_tenant_identity ON listings(tenant_id,id);
CREATE TABLE listing_knowledge_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id text NOT NULL, listing_id uuid NOT NULL,
 file_name text NOT NULL, mime_type text NOT NULL, size_bytes bigint NOT NULL,
 storage_key text NOT NULL, content_hash text NOT NULL, version integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'UPLOADED', error_code text, parser_version text NOT NULL DEFAULT '1',
 embedding_model text, embedding_dimension integer, is_active boolean NOT NULL DEFAULT true,
 effective_date date, supersedes_document_id uuid REFERENCES listing_knowledge_documents(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,listing_id,id), UNIQUE(tenant_id,listing_id,content_hash),
 FOREIGN KEY(tenant_id,listing_id) REFERENCES listings(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE listing_knowledge_chunks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id text NOT NULL, listing_id uuid NOT NULL, document_id uuid NOT NULL,
 sequence_no integer NOT NULL, text_content text NOT NULL, source jsonb NOT NULL, facts jsonb NOT NULL DEFAULT '[]',
 content_hash text NOT NULL, embedding extensions.vector(1536), embedding_model text,
 search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple',text_content)) STORED,
 UNIQUE(document_id,sequence_no), FOREIGN KEY(tenant_id,listing_id,document_id)
 REFERENCES listing_knowledge_documents(tenant_id,listing_id,id) ON DELETE CASCADE
);
CREATE TABLE listing_knowledge_ingestion_jobs (
 document_id uuid PRIMARY KEY REFERENCES listing_knowledge_documents(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'QUEUED', attempts integer NOT NULL DEFAULT 0,
 lease_token uuid, lease_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_knowledge_scope ON listing_knowledge_documents(tenant_id,listing_id,is_active,status);
CREATE INDEX listing_knowledge_chunk_scope ON listing_knowledge_chunks(tenant_id,listing_id,document_id);
CREATE INDEX listing_knowledge_fts ON listing_knowledge_chunks USING gin(search_vector);
CREATE INDEX listing_knowledge_vector ON listing_knowledge_chunks USING hnsw(embedding extensions.vector_cosine_ops);
ALTER TABLE listing_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_knowledge_ingestion_jobs ENABLE ROW LEVEL SECURITY;
-- No anonymous/authenticated direct reads: tenant authorization runs in the API.
REVOKE ALL ON listing_knowledge_documents,listing_knowledge_chunks,listing_knowledge_ingestion_jobs FROM anon,authenticated;
GRANT ALL ON listing_knowledge_documents,listing_knowledge_chunks,listing_knowledge_ingestion_jobs TO service_role;
CREATE FUNCTION claim_listing_knowledge_job() RETURNS TABLE(document_id uuid,lease_token uuid)
LANGUAGE plpgsql SET search_path=public,extensions AS $$
DECLARE chosen uuid; token uuid := gen_random_uuid();
BEGIN
 UPDATE listing_knowledge_documents d SET status='FAILED',error_code='WORKER_RETRY_EXHAUSTED',updated_at=now()
 FROM listing_knowledge_ingestion_jobs j WHERE j.document_id=d.id AND j.status='RUNNING' AND j.lease_until<now() AND j.attempts>=4;
 UPDATE listing_knowledge_ingestion_jobs SET status='FAILED' WHERE status='RUNNING' AND lease_until<now() AND attempts>=4;
 SELECT j.document_id INTO chosen FROM listing_knowledge_ingestion_jobs j
 JOIN listing_knowledge_documents d ON d.id=j.document_id AND d.is_active
 WHERE j.status='QUEUED' OR (j.status='RUNNING' AND j.lease_until<now() AND j.attempts<4)
 ORDER BY j.updated_at FOR UPDATE OF j SKIP LOCKED LIMIT 1;
 IF chosen IS NULL THEN RETURN; END IF;
 UPDATE listing_knowledge_ingestion_jobs j SET status='RUNNING',attempts=attempts+1,
 lease_token=token,lease_until=now()+interval '10 minutes',updated_at=now() WHERE j.document_id=chosen;
 RETURN QUERY SELECT chosen,token;
END $$;
CREATE FUNCTION search_listing_knowledge(p_tenant text,p_listing uuid,p_query text,p_embedding extensions.vector(1536) DEFAULT NULL,p_limit integer DEFAULT 8)
RETURNS TABLE(id uuid,document_id uuid,file_name text,text_content text,source jsonb,facts jsonb,score double precision)
LANGUAGE sql STABLE SET search_path=public,extensions AS $$
WITH eligible AS (
 SELECT c.*,d.file_name FROM listing_knowledge_chunks c JOIN listing_knowledge_documents d
 ON d.id=c.document_id AND d.tenant_id=c.tenant_id AND d.listing_id=c.listing_id
 WHERE c.tenant_id=p_tenant AND c.listing_id=p_listing AND d.is_active AND d.status='READY'
), lexical AS (
 SELECT e.id,row_number() OVER(ORDER BY ts_rank_cd(search_vector,websearch_to_tsquery('simple',p_query)) DESC,e.id) rank
 FROM eligible e WHERE search_vector @@ websearch_to_tsquery('simple',p_query)
 ORDER BY rank LIMIT 40
), semantic AS (
 SELECT e.id,row_number() OVER(ORDER BY embedding <=> p_embedding,e.id) rank FROM eligible e
 WHERE p_embedding IS NOT NULL AND embedding IS NOT NULL
 ORDER BY embedding <=> p_embedding LIMIT 40
), scores AS (
 SELECT coalesce(l.id,s.id) id,coalesce(1.0/(60+l.rank),0)+coalesce(1.0/(60+s.rank),0) score
 FROM lexical l FULL JOIN semantic s ON l.id=s.id
)
SELECT e.id,e.document_id,e.file_name,e.text_content,e.source,e.facts,s.score::double precision
FROM scores s JOIN eligible e ON e.id=s.id ORDER BY s.score DESC,e.id LIMIT greatest(1,least(p_limit,20));
$$;
REVOKE ALL ON FUNCTION claim_listing_knowledge_job() FROM PUBLIC;
REVOKE ALL ON FUNCTION search_listing_knowledge(text,uuid,text,extensions.vector,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_listing_knowledge_job() TO service_role;
GRANT EXECUTE ON FUNCTION search_listing_knowledge(text,uuid,text,extensions.vector,integer) TO service_role;

-- Register the durable job in the same transaction as the document record.
CREATE FUNCTION enqueue_listing_knowledge() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN INSERT INTO listing_knowledge_ingestion_jobs(document_id) VALUES(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER listing_knowledge_enqueue AFTER INSERT ON listing_knowledge_documents FOR EACH ROW EXECUTE FUNCTION enqueue_listing_knowledge();
CREATE FUNCTION checkpoint_listing_knowledge(p_document uuid,p_token uuid,p_status text,p_chunks jsonb DEFAULT NULL,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SET search_path=public,extensions AS $$
DECLARE d listing_knowledge_documents; j listing_knowledge_ingestion_jobs;
BEGIN
 SELECT * INTO j FROM listing_knowledge_ingestion_jobs WHERE document_id=p_document FOR UPDATE;
 SELECT * INTO d FROM listing_knowledge_documents WHERE id=p_document FOR UPDATE;
 IF j.lease_token IS DISTINCT FROM p_token OR j.status<>'RUNNING' OR NOT d.is_active THEN RETURN false; END IF;
 IF p_chunks IS NOT NULL THEN
  INSERT INTO listing_knowledge_chunks(tenant_id,listing_id,document_id,sequence_no,text_content,source,facts,content_hash,embedding,embedding_model)
  SELECT d.tenant_id,d.listing_id,d.id,(v->>'sequence')::integer,v->>'text',v->'source',v->'facts',v->>'hash',
   (v->>'embedding')::extensions.vector,v->>'model' FROM jsonb_array_elements(p_chunks) v
  ON CONFLICT(document_id,sequence_no) DO UPDATE SET text_content=excluded.text_content,source=excluded.source,facts=excluded.facts,
   content_hash=excluded.content_hash,embedding=excluded.embedding,embedding_model=excluded.embedding_model;
 END IF;
 IF p_status='READY' AND (NOT EXISTS(SELECT 1 FROM listing_knowledge_chunks WHERE document_id=p_document)
 OR EXISTS(SELECT 1 FROM listing_knowledge_chunks WHERE document_id=p_document AND embedding IS NULL)) THEN RAISE EXCEPTION 'Incomplete index'; END IF;
 UPDATE listing_knowledge_documents SET status=p_status,error_code=p_error,updated_at=now(),
 embedding_model=CASE WHEN p_status='READY' THEN 'text-embedding-3-small' ELSE embedding_model END,
 embedding_dimension=CASE WHEN p_status='READY' THEN 1536 ELSE embedding_dimension END WHERE id=p_document;
 UPDATE listing_knowledge_ingestion_jobs SET status=CASE WHEN p_status='READY' THEN 'DONE' WHEN p_status IN ('FAILED','OCR_REQUIRED') THEN 'FAILED' ELSE 'RUNNING' END,
 lease_until=now()+interval '10 minutes',updated_at=now() WHERE document_id=p_document;
 RETURN true;
END $$;
CREATE FUNCTION retry_listing_knowledge(p_tenant text,p_listing uuid,p_document uuid) RETURNS boolean
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM listing_knowledge_documents WHERE id=p_document AND tenant_id=p_tenant AND listing_id=p_listing AND is_active FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE listing_knowledge_ingestion_jobs SET status='QUEUED',attempts=0,lease_token=NULL,lease_until=NULL,updated_at=now()
 WHERE document_id=p_document AND status IN ('FAILED','DONE');
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE listing_knowledge_documents SET status='UPLOADED',error_code=NULL,updated_at=now() WHERE id=p_document;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION checkpoint_listing_knowledge(uuid,uuid,text,jsonb,text),retry_listing_knowledge(text,uuid,uuid),enqueue_listing_knowledge() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION checkpoint_listing_knowledge(uuid,uuid,text,jsonb,text),retry_listing_knowledge(text,uuid,uuid) TO service_role;

CREATE TABLE listing_media_videos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id text NOT NULL,listing_id uuid NOT NULL,
 file_name text NOT NULL,storage_key text NOT NULL,mime_type text NOT NULL,size_bytes bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,listing_id) REFERENCES listings(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX listing_media_videos_scope ON listing_media_videos(tenant_id,listing_id);
ALTER TABLE listing_media_videos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON listing_media_videos FROM anon,authenticated;
GRANT ALL ON listing_media_videos TO service_role;

COMMIT;
