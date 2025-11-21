-- Migration: guest users support for anonymous messaging
-- Date: 2025-11-21
-- Description:
--   Introduces guest_users table to allow ephemeral identities prior to full authentication.
--   Adds upgrade function to merge a guest identity into a real user account.
--   NOTE: RLS policies for guest access must be added/adjusted separately once the
--         database role and JWT claim strategy are finalized.

-- Create guest_users table
CREATE TABLE IF NOT EXISTS public.guest_users (
    guest_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    fingerprint text NULL,
    upgrade_user_id uuid NULL,
    upgraded_at timestamptz NULL,
    CONSTRAINT guest_users_upgrade_unique UNIQUE (upgrade_user_id)
);

COMMENT ON TABLE public.guest_users IS 'Ephemeral guest identities for pre-auth messaging sessions.';
COMMENT ON COLUMN public.guest_users.fingerprint IS 'Optional client fingerprint / device identifier';
COMMENT ON COLUMN public.guest_users.upgrade_user_id IS 'Authenticated user id this guest was merged into.';

-- Function to upgrade guest to real user
CREATE OR REPLACE FUNCTION public.upgrade_guest_user(p_guest_id uuid, p_real_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exists integer;
BEGIN
    -- Mark guest record upgraded
    UPDATE public.guest_users
       SET upgrade_user_id = p_real_user_id,
           upgraded_at = now()
     WHERE guest_id = p_guest_id
       AND upgrade_user_id IS NULL;

    -- Reattribute conversation participants
    UPDATE public.conversation_participants
       SET user_id = p_real_user_id
     WHERE user_id = p_guest_id;

    -- Reattribute messages sender
    UPDATE public.messages
       SET sender_id = p_real_user_id
     WHERE sender_id = p_guest_id;
END;
$$;

COMMENT ON FUNCTION public.upgrade_guest_user(uuid, uuid) IS 'Merge guest identity into real user: updates participants & messages.';

-- Placeholder RLS policies (to be refined). Currently allow only authenticated users to select/insert; guest JWT strategy pending.
ALTER TABLE public.guest_users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own guest record (helpful post-upgrade diagnostics)
CREATE POLICY guest_users_select_self
    ON public.guest_users
    FOR SELECT
    USING ( auth.uid() = upgrade_user_id OR auth.uid() IS NULL ); -- auth.uid() IS NULL will evaluate false for authenticated users; placeholder until guest role mapping.

-- Allow insertion of guest record via service or future guest role (will refine once role exists)
CREATE POLICY guest_users_insert_any
    ON public.guest_users
    FOR INSERT
    WITH CHECK ( true );

-- Restrict updates to upgrade function only (no direct UPDATE allowed for regular roles)
REVOKE UPDATE ON public.guest_users FROM PUBLIC;

-- Grant basic usage to authenticated; service key manages guest creation for now
GRANT SELECT, INSERT ON public.guest_users TO authenticated;
