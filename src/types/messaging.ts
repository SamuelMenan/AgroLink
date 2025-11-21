// New messaging system data models
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt?: string;
  deliveredAt?: string;
  mimeType?: string;
  attachments?: MessageAttachment[];
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface Conversation {
  id: string;
  participants: ConversationParticipant[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  archivedBy?: string[];
  blocked?: boolean;
  type: 'direct' | 'group';
  metadata?: Record<string, any>;
}

export interface ConversationParticipant {
  userId: string;
  joinedAt: string;
  lastReadAt?: string;
  role?: 'admin' | 'member';
  notificationsEnabled: boolean;
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'file' | 'location' | 'product';
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
  metadata?: Record<string, any>;
}

export interface MessagingUser {
  id: string;
  fullName: string;
  avatar?: string;
  isOnline: boolean;
  lastSeenAt?: string;
  blockedUsers: string[];
  privacySettings: {
    allowMessagesFrom: 'all' | 'contacts' | 'none';
    readReceipts: boolean;
    typingIndicators: boolean;
  };
}

export interface SendMessageRequest {
  conversationId: string;
  content: string;
  mimeType?: string;
  attachments?: MessageAttachment[];
  replyToId?: string;
}

export interface CreateConversationRequest {
  participantIds: string[];
  type: 'direct' | 'group';
  metadata?: Record<string, any>;
}

export interface MessageSearchFilters {
  query?: string;
  conversationId?: string;
  senderId?: string;
  dateFrom?: string;
  dateTo?: string;
  hasAttachments?: boolean;
}

export interface MessagingState {
  conversations: Conversation[];
  activeConversation?: Conversation;
  messages: Record<string, Message[]>;
  loading: boolean;
  error?: string;
  connected: boolean;
  unreadCounts: Record<string, number>;
  searchResults?: Message[];
  searchFilters: MessageSearchFilters;
  currentUserId: string;
}

export interface MessagingEvent {
  type: 'message_sent' | 'message_delivered' | 'message_read' | 'conversation_created' | 'user_typing' | 'user_online';
  data: any;
  timestamp: string;
}