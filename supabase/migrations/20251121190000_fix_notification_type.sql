-- Migration: fix notification trigger to use allowed type and proper columns
-- Drops old trigger/function and recreates with type = 'message'

-- Safety: drop existing trigger names if they differ
DROP TRIGGER IF EXISTS trg_messages_notify ON public.messages;
DROP TRIGGER IF EXISTS notify_on_message ON public.messages;

-- Drop old function if exists
DROP FUNCTION IF EXISTS public.notify_new_message();
DROP FUNCTION IF EXISTS public.notify_message();

-- Recreate notification function aligned with current notifications schema
-- Current notifications columns: (id, user_id, type, title, body, url, severity, read_at, created_at)
-- We keep severity as 'info' or switch to 'message' if 'info' is invalid. Using 'message' for consistency.
CREATE OR REPLACE FUNCTION public.notify_message()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, url, severity)
  SELECT
    cp.user_id,
    'message',                 -- allowed type
    'Nuevo mensaje',
    NEW.content,               -- body stores content (plaintext)
    '/messages/' || NEW.conversation_id,
    'message'                  -- severity adjusted from 'info' to 'message'
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id <> NEW.sender_id;  -- do not notify sender
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new trigger
CREATE TRIGGER notify_on_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_message();

-- Optional: comment for clarity
COMMENT ON FUNCTION public.notify_message() IS 'Inserta notificaciones de tipo message al recibir un nuevo mensaje.';
