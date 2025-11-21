-- New messaging system database schema
-- This creates a simplified, more efficient messaging system

-- Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'group')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT now(),
    last_read_at TIMESTAMPTZ,
    notifications_enabled BOOLEAN DEFAULT true,
    PRIMARY KEY (conversation_id, user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 2000),
    mime_type VARCHAR(100) DEFAULT 'text/plain',
    attachments JSONB DEFAULT '[]',
    reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    edited_at TIMESTAMPTZ
);

-- Message read receipts
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (message_id, user_id)
);

-- Archived conversations
CREATE TABLE IF NOT EXISTS public.archived_conversations (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    archived_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

-- Blocked users
CREATE TABLE IF NOT EXISTS public.blocked_users (
    blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id != blocked_id)
);

-- User messaging preferences
CREATE TABLE IF NOT EXISTS public.user_messaging_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    allow_messages_from VARCHAR(20) DEFAULT 'all' CHECK (allow_messages_from IN ('all', 'contacts', 'none')),
    read_receipts_enabled BOOLEAN DEFAULT true,
    typing_indicators_enabled BOOLEAN DEFAULT true,
    sound_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_user_id ON public.message_read_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_archived_conversations_user_id ON public.archived_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_id ON public.blocked_users(blocker_id);

-- RLS Policies
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_messaging_preferences ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "Users can view conversations they participate in" ON public.conversations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp 
            WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create conversations" ON public.conversations
    FOR INSERT WITH CHECK (true);

-- Conversation participants policies
CREATE POLICY "Users can view participants in their conversations" ON public.conversation_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp2 
            WHERE cp2.conversation_id = conversation_participants.conversation_id 
            AND cp2.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add participants to conversations they participate in" ON public.conversation_participants
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp 
            WHERE cp.conversation_id = conversation_participants.conversation_id 
            AND cp.user_id = auth.uid()
        )
    );

-- Messages policies
CREATE POLICY "Users can view messages in their conversations" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp 
            WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send messages in conversations they participate in" ON public.messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp 
            WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own messages" ON public.messages
    FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "Users can soft delete their own messages" ON public.messages
    FOR UPDATE USING (sender_id = auth.uid()) WITH CHECK (deleted_at IS NOT NULL);

-- Message read receipts policies
CREATE POLICY "Users can create read receipts for messages in their conversations" ON public.message_read_receipts
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.messages m 
            JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id 
            WHERE m.id = message_read_receipts.message_id AND cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view read receipts for their messages" ON public.message_read_receipts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.messages m 
            WHERE m.id = message_read_receipts.message_id AND m.sender_id = auth.uid()
        )
    );

-- Archived conversations policies
CREATE POLICY "Users can view their archived conversations" ON public.archived_conversations
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can archive conversations they participate in" ON public.archived_conversations
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unarchive their conversations" ON public.archived_conversations
    FOR DELETE USING (user_id = auth.uid());

-- Blocked users policies
CREATE POLICY "Users can view their blocked users list" ON public.blocked_users
    FOR SELECT USING (blocker_id = auth.uid());

CREATE POLICY "Users can block other users" ON public.blocked_users
    FOR INSERT WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can unblock users" ON public.blocked_users
    FOR DELETE USING (blocker_id = auth.uid());

-- User messaging preferences policies
CREATE POLICY "Users can view their own preferences" ON public.user_messaging_preferences
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences" ON public.user_messaging_preferences
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can create their own preferences" ON public.user_messaging_preferences
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Grant permissions
GRANT SELECT ON public.conversations TO anon, authenticated;
GRANT INSERT ON public.conversations TO authenticated;
GRANT SELECT ON public.conversation_participants TO anon, authenticated;
GRANT INSERT ON public.conversation_participants TO authenticated;
GRANT SELECT ON public.messages TO anon, authenticated;
GRANT INSERT ON public.messages TO authenticated;
GRANT UPDATE ON public.messages TO authenticated;
GRANT SELECT ON public.message_read_receipts TO anon, authenticated;
GRANT INSERT ON public.message_read_receipts TO authenticated;
GRANT SELECT ON public.archived_conversations TO anon, authenticated;
GRANT INSERT ON public.archived_conversations TO authenticated;
GRANT DELETE ON public.archived_conversations TO authenticated;
GRANT SELECT ON public.blocked_users TO anon, authenticated;
GRANT INSERT ON public.blocked_users TO authenticated;
GRANT DELETE ON public.blocked_users TO authenticated;
GRANT SELECT ON public.user_messaging_preferences TO anon, authenticated;
GRANT INSERT ON public.user_messaging_preferences TO authenticated;
GRANT UPDATE ON public.user_messaging_preferences TO authenticated;

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_messaging_preferences_updated_at BEFORE UPDATE ON public.user_messaging_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();