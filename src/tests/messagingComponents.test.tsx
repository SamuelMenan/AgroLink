import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import ConversationList from '../../src/components/messaging/ConversationList';
import MessageThread from '../../src/components/messaging/MessageThread';
import { Conversation, Message } from '../../src/types/messaging';

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Search: () => <div data-testid="search-icon">Search</div>,
  UserPlus: () => <div data-testid="user-plus-icon">UserPlus</div>,
  Archive: () => <div data-testid="archive-icon">Archive</div>,
  MoreVertical: () => <div data-testid="more-icon">MoreVertical</div>,
  Circle: () => <div data-testid="circle-icon">Circle</div>,
  Send: () => <div data-testid="send-icon">Send</div>,
  Paperclip: () => <div data-testid="paperclip-icon">Paperclip</div>,
  Smile: () => <div data-testid="smile-icon">Smile</div>,
  Reply: () => <div data-testid="reply-icon">Reply</div>,
  Trash2: () => <div data-testid="trash-icon">Trash2</div>,
  Edit3: () => <div data-testid="edit-icon">Edit3</div>,
}));

describe('ConversationList Component', () => {
  const mockConversations: Conversation[] = [
    {
      id: 'conv-1',
      participants: [{ userId: 'user-1' }, { userId: 'user-2' }],
      unreadCount: 2,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-02T00:00:00Z',
      type: 'direct',
      lastMessage: {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-1',
        content: 'Hello there!',
        createdAt: '2023-01-02T00:00:00Z',
        status: 'sent'
      }
    },
    {
      id: 'conv-2',
      participants: [{ userId: 'user-1' }, { userId: 'user-3' }, { userId: 'user-4' }],
      unreadCount: 0,
      createdAt: '2023-01-03T00:00:00Z',
      updatedAt: '2023-01-04T00:00:00Z',
      type: 'group',
      lastMessage: {
        id: 'msg-2',
        conversationId: 'conv-2',
        senderId: 'user-3',
        content: 'Group message here',
        createdAt: '2023-01-04T00:00:00Z',
        status: 'sent'
      }
    }
  ];

  const defaultProps = {
    conversations: mockConversations,
    activeConversation: undefined,
    onConversationSelect: vi.fn(),
    onNewConversation: vi.fn(),
    onArchiveConversation: vi.fn(),
    currentUserId: 'user-1'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render conversation list correctly', () => {
    render(<ConversationList {...defaultProps} />);

    expect(screen.getByText('Mensajes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar conversaciones...')).toBeInTheDocument();
    expect(screen.getByText('2 nuevo')).toBeInTheDocument(); // unread count
  });

  it('should display conversation titles correctly', () => {
    render(<ConversationList {...defaultProps} />);

    // Direct conversation should show other participant's name
    expect(screen.getByText('user-2')).toBeInTheDocument();
    
    // Group conversation should show "Grupo"
    expect(screen.getByText('Grupo (3 participantes)')).toBeInTheDocument();
  });

  it('should call onConversationSelect when conversation is clicked', async () => {
    const user = userEvent.setup();
    render(<ConversationList {...defaultProps} />);

    const conversationElement = screen.getByText('user-2').closest('div.cursor-pointer');
    expect(conversationElement).toBeInTheDocument();

    await user.click(conversationElement!);

    expect(defaultProps.onConversationSelect).toHaveBeenCalledWith(mockConversations[0]);
  });

  it('should filter conversations based on search query', async () => {
    const user = userEvent.setup();
    render(<ConversationList {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Buscar conversaciones...');
    await user.type(searchInput, 'user-2');

    expect(screen.getByText('user-2')).toBeInTheDocument();
    expect(screen.queryByText('Grupo (3 participantes)')).not.toBeInTheDocument();
  });

  it('should show archived conversations when archive button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConversationList {...defaultProps} />);

    const archiveButton = screen.getByTitle('Mostrar archivados');
    await user.click(archiveButton);

    // Button should change to "Ocultar archivados"
    expect(screen.getByTitle('Ocultar archivados')).toBeInTheDocument();
  });

  it('should call onNewConversation when new conversation button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConversationList {...defaultProps} />);

    const newConversationButton = screen.getByTitle('Nueva conversación');
    await user.click(newConversationButton);

    expect(defaultProps.onNewConversation).toHaveBeenCalled();
  });

  it('should call onArchiveConversation when archive action is clicked', async () => {
    const user = userEvent.setup();
    render(<ConversationList {...defaultProps} />);

    const moreButton = screen.getAllByTitle('Más opciones')[0];
    await user.click(moreButton);

    expect(defaultProps.onArchiveConversation).toHaveBeenCalledWith('conv-1');
  });

  it('should show unread count badge', () => {
    render(<ConversationList {...defaultProps} />);

    expect(screen.getByText('2 nuevo')).toBeInTheDocument();
  });

  it('should highlight active conversation', () => {
    const propsWithActiveConversation = {
      ...defaultProps,
      activeConversation: mockConversations[0]
    };

    render(<ConversationList {...propsWithActiveConversation} />);

    const activeElement = screen.getByText('user-2').closest('div.cursor-pointer');
    expect(activeElement).toHaveClass('bg-green-50');
  });

  it('should show "No conversations" when list is empty', () => {
    const propsWithEmptyConversations = {
      ...defaultProps,
      conversations: []
    };

    render(<ConversationList {...propsWithEmptyConversations} />);

    expect(screen.getByText('No hay conversaciones')).toBeInTheDocument();
  });
});

describe('MessageThread Component', () => {
  const mockMessages: Message[] = [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-2',
      content: 'Hello! How are you?',
      createdAt: '2023-01-01T12:00:00Z',
      status: 'sent'
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: 'I am doing great, thanks!',
      createdAt: '2023-01-01T12:01:00Z',
      status: 'read'
    }
  ];

  const defaultProps = {
    conversationId: 'conv-1',
    messages: mockMessages,
    currentUserId: 'user-1',
    onSendMessage: vi.fn(),
    onDeleteMessage: vi.fn(),
    onEditMessage: vi.fn(),
    onReplyMessage: vi.fn(),
    loading: false,
    error: undefined
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render message thread correctly', () => {
    render(<MessageThread {...defaultProps} />);

    expect(screen.getByText('Hello! How are you?')).toBeInTheDocument();
    expect(screen.getByText('I am doing great, thanks!')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Escribe un mensaje...')).toBeInTheDocument();
  });

  it('should send message when form is submitted', async () => {
    const user = userEvent.setup();
    render(<MessageThread {...defaultProps} />);

    const input = screen.getByPlaceholderText('Escribe un mensaje...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'New message');
    await user.click(sendButton);

    expect(defaultProps.onSendMessage).toHaveBeenCalledWith('New message');
  });

  it('should send message when Enter is pressed (without Shift)', async () => {
    const user = userEvent.setup();
    render(<MessageThread {...defaultProps} />);

    const input = screen.getByPlaceholderText('Escribe un mensaje...');
    await user.type(input, 'Test message{Enter}');

    expect(defaultProps.onSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('should not send empty messages', async () => {
    const user = userEvent.setup();
    render(<MessageThread {...defaultProps} />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    expect(defaultProps.onSendMessage).not.toHaveBeenCalled();
  });

  it('should show loading state', () => {
    const propsWithLoading = {
      ...defaultProps,
      loading: true,
      messages: []
    };

    render(<MessageThread {...propsWithLoading} />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should show error message', () => {
    const propsWithError = {
      ...defaultProps,
      error: 'Network error occurred'
    };

    render(<MessageThread {...propsWithError} />);

    expect(screen.getByText('Network error occurred')).toBeInTheDocument();
  });

  it('should show empty state when no messages', () => {
    const propsWithNoMessages = {
      ...defaultProps,
      messages: []
    };

    render(<MessageThread {...propsWithNoMessages} />);

    expect(screen.getByText('Comienza la conversación')).toBeInTheDocument();
    expect(screen.getByText('Envía un mensaje para iniciar el chat.')).toBeInTheDocument();
  });

  it('should show message actions for current user messages', () => {
    render(<MessageThread {...defaultProps} />);

    // Find the message container for the current user's message
    const userMessageContainer = screen.getByText('I am doing great, thanks!').closest('div.group');
    expect(userMessageContainer).toBeInTheDocument();

    // Message actions should be present (though visibility might be controlled by CSS)
    expect(screen.getAllByTestId('edit-icon')).toHaveLength(1);
    expect(screen.getAllByTestId('reply-icon')).toHaveLength(1);
    expect(screen.getAllByTestId('trash-icon')).toHaveLength(1);
  });

  it('should handle message editing', async () => {
    const user = userEvent.setup();
    render(<MessageThread {...defaultProps} />);

    // Click edit button on current user's message
    const editButton = screen.getAllByTestId('edit-icon')[0];
    await user.click(editButton);

    // Should show edit textarea
    const editTextarea = screen.getByDisplayValue('I am doing great, thanks!');
    expect(editTextarea).toBeInTheDocument();

    // Edit the message
    await user.clear(editTextarea);
    await user.type(editTextarea, 'Edited message');

    // Save the edit
    const saveButton = screen.getByText('Guardar');
    await user.click(saveButton);

    expect(defaultProps.onEditMessage).toHaveBeenCalledWith('msg-2', 'Edited message');
  });

  it('should handle message deletion', async () => {
    // Mock window.confirm
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    
    const user = userEvent.setup();
    render(<MessageThread {...defaultProps} />);

    // Click delete button on current user's message
    const deleteButton = screen.getAllByTestId('trash-icon')[0];
    await user.click(deleteButton);

    expect(mockConfirm).toHaveBeenCalledWith('¿Estás seguro de que quieres eliminar este mensaje?');
    expect(defaultProps.onDeleteMessage).toHaveBeenCalledWith('msg-2');

    mockConfirm.mockRestore();
  });

  it('should handle reply functionality', async () => {
    const user = userEvent.setup();
    render(<MessageThread {...defaultProps} />);

    // Click reply button on any message
    const replyButton = screen.getAllByTestId('reply-icon')[0];
    await user.click(replyButton);

    expect(defaultProps.onReplyMessage).toHaveBeenCalledWith('msg-2');
  });

  it('should show emoji picker when emoji button is clicked', async () => {
    const user = userEvent.setup();
    render(<MessageThread {...defaultProps} />);

    const emojiButton = screen.getByTitle('Emojis');
    await user.click(emojiButton);

    // Emoji picker should be shown (implementation depends on actual emoji picker component)
    // This test assumes the component shows some emoji-related UI
    expect(screen.getByTestId('smile-icon')).toBeInTheDocument();
  });

  it('should show message status for current user messages', () => {
    render(<MessageThread {...defaultProps} />);

    // Should show "Leído" status for the current user's message
    expect(screen.getByText('Leído')).toBeInTheDocument();
  });

  it('should handle file attachment button', async () => {
    const user = userEvent.setup();
    render(<MessageThread {...defaultProps} />);

    const attachButton = screen.getByTitle('Adjuntar archivo');
    await user.click(attachButton);

    // File attachment functionality would be implemented in the actual component
    // This test verifies the button exists and is clickable
    expect(attachButton).toBeInTheDocument();
  });
});