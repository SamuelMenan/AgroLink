-- Expose limited public info from auth.users via a SECURITY DEFINER function
-- Allows client to fetch name/email (and optional location metadata) for a set of user ids

create or replace function public.get_user_public_info(uids uuid[])
returns table(id uuid, full_name text, email text, location text, phone text)
language sql
security definer
set search_path = public, auth
as $$
  select u.id,
         coalesce(u.raw_user_meta_data->>'full_name','') as full_name,
         coalesce(u.email,'') as email,
    coalesce(u.raw_user_meta_data->>'location','') as location,
    coalesce(u.phone, u.raw_user_meta_data->>'phone', '') as phone
  from auth.users u
  where u.id = any(uids);
$$;

-- Grant execute to authenticated
grant execute on function public.get_user_public_info(uuid[]) to authenticated;
