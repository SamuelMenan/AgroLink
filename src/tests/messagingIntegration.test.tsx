import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MessagingWrapper from '../pages/messages/MessagingWrapper'

// Mock the messaging service
vi.mock('../services/messagingService', () => ({
  messagingService: {
    getConversations: vi.fn().mockResolvedValue({
      conversations: [],
      total: 0,
      page: 1,
      perPage: 20
    }),
    connectToRealtimeEvents: vi.fn(),
    disconnectFromRealtimeEvents: vi.fn()
  }
}))

// Mock auth context
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: 'test-user', email: 'test@example.com' },
    loading: false
  })
}))

describe('Messaging System Integration', () => {
  it('should render messaging page without context errors', async () => {
    render(
      <MemoryRouter initialEntries={['/messages']}>
        <Routes>
          <Route path="/messages" element={<MessagingWrapper />} />
        </Routes>
      </MemoryRouter>
    )

    // Should show loading state initially
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()

    // Wait for the component to load
    await screen.findByText(/mensajes/i)
    
    // Should show the messaging interface
    expect(screen.getByText(/mensajes/i)).toBeInTheDocument()
    expect(screen.getByText(/no hay conversaciones/i)).toBeInTheDocument()
  })

  it('should handle URL parameter for opening specific conversation', async () => {
    const testUserId = 'test-user-123'
    
    render(
      <MemoryRouter initialEntries={[`/messages?with=${testUserId}`]}>
        <Routes>
          <Route path="/messages" element={<MessagingWrapper />} />
        </Routes>
      </MemoryRouter>
    )

    // Should load and handle the URL parameter
    await screen.findByText(/mensajes/i)
    expect(screen.getByText(/no hay conversaciones/i)).toBeInTheDocument()
  })
})