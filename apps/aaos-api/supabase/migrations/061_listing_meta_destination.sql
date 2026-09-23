BEGIN;
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS meta_page_id text,
  ADD COLUMN IF NOT EXISTS meta_ad_account_id text;
COMMENT ON COLUMN public.listings.meta_page_id IS 'Facebook Page selected from the tenant ad account; revalidate with Meta before campaign launch.';
COMMIT;
