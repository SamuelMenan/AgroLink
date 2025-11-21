-- Create missing functions for messaging system

-- Function to check if a user is a participant in a conversation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(
  conversation_id uuid,
  user_id uuid
) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.conversation_participants 
    WHERE conversation_participants.conversation_id = $1 
    AND conversation_participants.user_id = $2
  );
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO anon;

-- Function to create a conversation with participants (RPC function)
CREATE OR REPLACE FUNCTION public.create_conversation(
  product_id uuid DEFAULT NULL,
  participant_ids uuid[] DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_conversation_id uuid;
  participant_uuid uuid;
BEGIN
  -- Create the conversation
  INSERT INTO public.conversations (product_id)
  VALUES ($1)
  RETURNING id INTO new_conversation_id;
  
  -- Add participants if provided
  IF participant_ids IS NOT NULL THEN
    FOREACH participant_uuid IN ARRAY participant_ids
    LOOP
      INSERT INTO public.conversation_participants (conversation_id, user_id)
      VALUES (new_conversation_id, participant_uuid)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN new_conversation_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_conversation(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_conversation(uuid, uuid[]) TO anon;

-- Check if functions exist
SELECT 
  'Function exists: is_conversation_participant' as status
WHERE EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'is_conversation_participant')
UNION ALL
SELECT 
  'Function exists: create_conversation' as status  
WHERE EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'create_conversation');