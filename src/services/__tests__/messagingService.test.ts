import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as auth from '../apiAuth'
import { createConversation, sendMessage } from '../messagingService'

const OK = (data: any) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
const CREATED = (data: any) => new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } })
const TEXT = (status: number, text: string) => new Response(text, { status, headers: { 'Content-Type': 'text/plain' } })

describe('messagingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(auth, 'getAccessToken').mockReturnValue('header.payload.signature')
    // minimal JWT payload
    const payload = { sub: 'user-1' }
    vi.spyOn(window, 'atob').mockImplementation((s: string) => {
      if (s.length < 0) return ''
      return JSON.stringify(payload)
    })
  })

  it('fallback de createConversation tras RPC 404 sin doble lectura', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/rpc/create_conversation')) return TEXT(404, 'not found')
      if (url.includes('/api/proxy/api/v1/conversations') && url.includes('buyer_id')) {
        return CREATED({ id: 'conv-1' })
      }
      if (url.includes('/messages')) return CREATED([{ id: 'msg-1' }])
      return OK({})
    })
    const conv = await createConversation({ participantId: 'user-2', productId: 'prod-1', initialMessage: 'hola' })
    expect(conv.id).toBeDefined()
    expect(fetchMock).toHaveBeenCalled()
  })

  it('sendMessage reintenta tras 403 por no ser participante', async () => {
    let firstAttempt = true
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('action=add-participant')) return CREATED({ ok: true })
      if (url.includes('action=messages')) {
        if (firstAttempt) {
          firstAttempt = false
          return TEXT(403, 'No eres participante de esta conversación')
        }
        return CREATED([{ id: 'msg-2', content: 'hola' }])
      }
      return OK({})
    })
    const msg = await sendMessage('conv-1', 'user-1', 'Alice', 'hola', true)
    expect(msg).toBeDefined()
  })
})