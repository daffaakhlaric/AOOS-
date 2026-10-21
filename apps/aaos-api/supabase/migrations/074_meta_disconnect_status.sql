-- Keep disconnect terminal until a new credential is explicitly supplied.
-- Additive function replacement; no data deletion or automatic privilege changes.
begin;
create or replace function public.bump_meta_integration_version() returns trigger
language plpgsql set search_path=public as $$
begin
  if row(new.meta_access_token,new.meta_access_token_encrypted,new.meta_ad_account_id,new.meta_page_id,
         new.meta_instagram_id,new.meta_whatsapp_destination,new.meta_api_version,new.meta_connection_source)
    is distinct from row(old.meta_access_token,old.meta_access_token_encrypted,old.meta_ad_account_id,old.meta_page_id,
         old.meta_instagram_id,old.meta_whatsapp_destination,old.meta_api_version,old.meta_connection_source) then
    new.meta_credential_version := old.meta_credential_version + 1;
    new.meta_integration_status := case
      when nullif(new.meta_access_token_encrypted,'') is null and nullif(new.meta_access_token,'') is null
        then 'DISCONNECTED'
      else 'DEGRADED'
    end;
    new.meta_last_validated_at := null;
    new.meta_capabilities := null;
    new.meta_execution_tier := 'READ_ONLY';
  end if;
  return new;
end $$;
commit;
