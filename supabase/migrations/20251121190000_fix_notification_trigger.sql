-- Fix notification trigger to use correct column names and values
-- This matches the existing notifications table schema

DROP TRIGGER IF EXISTS trg_messages_notify ON public.messages;

CREATE OR REPLACE FUNCTION public.notify_new_message() RETURNS TRIGGER AS $$
DECLARE
  rid uuid;
BEGIN
  FOR rid IN SELECT user_id 
             FROM public.conversation_participants 
             WHERE conversation_id = NEW.conversation_id 
             AND user_id <> NEW.sender_id 
  LOOP
    INSERT INTO public.notifications(user_id, type, title, body, url, severity)
    VALUES (rid, 'message', 'Nuevo mensaje', NEW.content, '/messages', 'info');
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_messages_notify \AFTER INSERT ON public.messages 
FOR EACH ROW 
EXECUTE FUNCTION public.notify_new_message();