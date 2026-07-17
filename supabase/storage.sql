-- =============================================================================
-- The Belfry — evidence image storage
--
-- Images are too large to live in a synced table column (a multi-MB data URL
-- exceeds Realtime's payload limit and comes back truncated, breaking the
-- image). They go in a private Storage bucket instead; the board stores only
-- the object path, and resolves it to a short-lived signed URL at render time.
--
-- SETUP — do this in order:
--   1. Dashboard -> Storage -> New bucket
--        Name:   evidence
--        Public: OFF  (leave it private — the policies below are the gate)
--   2. Run this file in the SQL Editor. Safe to re-run.
--
-- Security model (same as the tables): the bucket is private, so anon gets
-- nothing. Only a mapped knight can read or write, enforced by RLS on
-- storage.objects via the same current_knight() function the board tables use.
-- A stranger cannot read the RLS-gated row that holds the path, so they can
-- never even learn a path to request.
-- =============================================================================

-- Knights may read evidence images (needed to mint signed URLs).
drop policy if exists "knights read evidence" on storage.objects;
create policy "knights read evidence" on storage.objects
  for select to authenticated
  using (bucket_id = 'evidence' and public.current_knight() is not null);

-- Knights may upload evidence images.
drop policy if exists "knights upload evidence" on storage.objects;
create policy "knights upload evidence" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidence' and public.current_knight() is not null);

-- Knights may replace an evidence image (upsert / re-upload).
drop policy if exists "knights update evidence" on storage.objects;
create policy "knights update evidence" on storage.objects
  for update to authenticated
  using (bucket_id = 'evidence' and public.current_knight() is not null)
  with check (bucket_id = 'evidence' and public.current_knight() is not null);

-- Knights may delete evidence images (e.g. when purging a clue).
drop policy if exists "knights delete evidence" on storage.objects;
create policy "knights delete evidence" on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidence' and public.current_knight() is not null);

-- Verify: should list the four policies above.
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname like '%evidence%'
order by policyname;
