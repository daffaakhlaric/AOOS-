-- Phase 3. Additive only. No automatic membership backfill from editable auth metadata.
begin;
create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id text not null references public.tenants(tenant_id),
  role text not null check(role in ('OWNER','ADMIN','MEDIA_BUYER','CREATIVE','VIEWER')),
  status text not null default 'ACTIVE' check(status in ('ACTIVE','SUSPENDED')),
  created_at timestamptz not null default now(),
  unique(user_id,tenant_id)
);
create table if not exists public.superadmin_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.tenant_memberships enable row level security;
alter table public.superadmin_entitlements enable row level security;
revoke all on public.tenant_memberships, public.superadmin_entitlements from anon, authenticated;
grant all on public.tenant_memberships, public.superadmin_entitlements to service_role;
alter table public.tenants
  add column if not exists meta_credential_version bigint not null default 1,
  add column if not exists meta_integration_status text not null default 'NOT_CONNECTED',
  add column if not exists meta_page_id text,
  add column if not exists meta_instagram_id text,
  add column if not exists meta_whatsapp_destination text,
  add column if not exists meta_last_validated_at timestamptz,
  add column if not exists meta_last_refreshed_at timestamptz,
  add column if not exists meta_capabilities jsonb,
  add column if not exists meta_execution_tier text not null default 'READ_ONLY'
    check(meta_execution_tier in ('READ_ONLY','WRITE_TESTING','COPILOT_READY','AUTONOMOUS_ELIGIBLE'));
-- Database-owned version protects direct SQL edits and all API instances.
create or replace function public.bump_meta_integration_version() returns trigger
language plpgsql set search_path=public as $$
begin
  if row(new.meta_access_token,new.meta_access_token_encrypted,new.meta_ad_account_id,new.meta_page_id,
         new.meta_instagram_id,new.meta_whatsapp_destination,new.meta_api_version,new.meta_connection_source)
    is distinct from row(old.meta_access_token,old.meta_access_token_encrypted,old.meta_ad_account_id,old.meta_page_id,
         old.meta_instagram_id,old.meta_whatsapp_destination,old.meta_api_version,old.meta_connection_source) then
    new.meta_credential_version := old.meta_credential_version + 1;
    new.meta_integration_status := 'DEGRADED';
    new.meta_last_validated_at := null;
    new.meta_capabilities := null;
  end if;
  return new;
end $$;
drop trigger if exists tenants_meta_version on public.tenants;
create trigger tenants_meta_version before update on public.tenants
for each row execute function public.bump_meta_integration_version();
commit;
