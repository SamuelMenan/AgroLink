-- Migration: asegurar que el tipo de notificación 'message' sea válido y
-- corregir el trigger de mensajes para insertar notificaciones coherentes.

-- Safety: drop existing trigger names if they differ
DROP TRIGGER IF EXISTS trg_messages_notify ON public.messages;
DROP TRIGGER IF EXISTS notify_on_message ON public.messages;

-- Drop old function if exists
DROP FUNCTION IF EXISTS public.notify_new_message();
DROP FUNCTION IF EXISTS public.notify_message();

-- Eliminar constraint si existe y recrearlo con los tipos usados por la app
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'message',
    'system',
    'request_new',
    'request_update',
    'order_update'
  ));

-- Función de notificación coherente con el esquema actual
CREATE OR REPLACE FUNCTION public.notify_message()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, url, severity)
  SELECT
    cp.user_id,
    'message',
    'Nuevo mensaje',
    NEW.content,
    '/messages/' || NEW.conversation_id,
    'info'
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id <> NEW.sender_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new trigger
CREATE TRIGGER notify_on_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_message();

-- Optional: comment for clarity
COMMENT ON FUNCTION public.notify_message() IS 'Inserta notificaciones de tipo message al recibir un nuevo mensaje.';
