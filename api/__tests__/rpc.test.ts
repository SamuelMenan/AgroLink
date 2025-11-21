import { describe, it, expect, vi, beforeEach } from 'vitest'
import handlerRoot from '../rpc.js'
import handlerFn from '../rpc/[fn].js'

const makeReq = (method: string, url: string, headers?: Record<string, string>, bodyObj?: any) => {
  const headersLower = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v]))
  const req: any = {
    method,
    url,
    headers: headersLower,
    [Symbol.asyncIterator]: bodyObj
      ? async function* () { yield Buffer.from(JSON.stringify(bodyObj)) }
      : async function* () { }
  }
  return req
}

const makeRes = () => {
  const res: any = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    setHeader: (k: string, v: string) => { res.headers[k] = v },
    status: (code: number) => { res.statusCode = code; return res },
    json: (obj: any) => { res.body = obj; return res },
    end: () => { return res }
  }
  return res
}

describe('rpc handlers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('"conv-123"', { status: 200 }))
    process.env.SUPABASE_URL = 'https://x.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon'
  })

  it('HEAD returns 200 on root', async () => {
    const req = makeReq('HEAD', '/api/rpc/create_conversation', { origin: 'http://localhost', authorization: 'Bearer t' })
    const res = makeRes()
    await handlerRoot(req, res)
    expect(res.statusCode).toBe(200)
  })

  it('POST returns 200 and payload on dynamic', async () => {
    const req = makeReq('POST', '/api/rpc/create_conversation', { origin: 'http://localhost', authorization: 'Bearer t', 'content-type': 'application/json' }, { product_id: 'p', participant_ids: ['a','b'] })
    const res = makeRes()
    await handlerFn(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('conv-123')
  })
})
