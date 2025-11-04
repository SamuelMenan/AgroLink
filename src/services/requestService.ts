import { isSupabaseEnabled, supabase } from './supabaseClient'

export type RequestStatus = 'pendiente' | 'aceptada' | 'rechazada'

export type CommercialRequest = {
  id: string
  buyer_id: string
  producer_id: string
  product_id?: string | null
  message?: string | null
  status: RequestStatus
  created_at: string
  updated_at?: string | null
}

const TABLE = 'requests'
const LS_KEY = 'agrolink_requests'

export async function createRequest(params: { buyerId: string; producerId: string; productId?: string; message?: string }): Promise<CommercialRequest> {
  // Protección inmediata en cliente: evitar autodenominación
  if (params.buyerId === params.producerId) {
    throw new Error('No puedes enviarte una solicitud a ti mismo.')
  }
  const now = new Date().toISOString()
  const base: Omit<CommercialRequest, 'id'> = {
    buyer_id: params.buyerId,
    producer_id: params.producerId,
    product_id: params.productId ?? null,
    message: params.message ?? null,
    status: 'pendiente',
    created_at: now,
    updated_at: null,
  }

  if (!isSupabaseEnabled()) {
    // En local, imponemos límite: máx 10 pendientes
    const all = getLocal()
    const active = all.filter(r => r.buyer_id === params.buyerId && r.status === 'pendiente')
    if (active.length >= 10) throw new Error('Has alcanzado el límite de 10 solicitudes activas.')
    const rec: CommercialRequest = { id: crypto.randomUUID(), ...base }
    all.push(rec)
    setLocal(all)
    return rec
  }

  // En Supabase: insert
  const { data, error } = await supabase.from(TABLE).insert({
    buyer_id: base.buyer_id, producer_id: base.producer_id, product_id: base.product_id, message: base.message, status: base.status, created_at: base.created_at,
  }).select('*').single()
  if (error) throw new Error(error.message)
  return data as CommercialRequest
}

export async function listMyRequests(buyerId: string): Promise<CommercialRequest[]> {
  if (!isSupabaseEnabled()) return getLocal().filter(r => r.buyer_id === buyerId).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())
  const { data, error } = await supabase.from(TABLE).select('*').eq('buyer_id', buyerId).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as CommercialRequest[]
}

export async function listIncomingRequests(producerId: string): Promise<CommercialRequest[]> {
  if (!isSupabaseEnabled()) return getLocal().filter(r => r.producer_id === producerId).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())
  const { data, error } = await supabase.from(TABLE).select('*').eq('producer_id', producerId).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as CommercialRequest[]
}

export async function updateRequestStatus(id: string, status: RequestStatus): Promise<void> {
  if (!isSupabaseEnabled()) {
    const all = getLocal()
    const idx = all.findIndex(r => r.id === id)
    if (idx !== -1) { all[idx] = { ...all[idx], status, updated_at: new Date().toISOString() }; setLocal(all) }
    return
  }
  const { error } = await supabase.from(TABLE).update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

// Local helpers
function getLocal(): CommercialRequest[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as CommercialRequest[]) : []
  } catch { return [] }
}
function setLocal(list: CommercialRequest[]) { localStorage.setItem(LS_KEY, JSON.stringify(list)) }
