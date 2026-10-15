-- Supabase default privileges can grant anon directly, in addition to PUBLIC.
revoke all on function public.tecnodrill_complete_first_access() from anon;
