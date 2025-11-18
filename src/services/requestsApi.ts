import { apiFetch } from './apiClient'
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

export async function createRequest(params: { buyerId: string; producerId: string; productId?: string; message?: string }): Promise<CommercialRequest> {
  const body = { buyerId: params.buyerId, producerId: params.producerId, productId: params.productId, message: params.message }
  try {
    const resp = await apiFetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!resp.ok) throw new Error('No se pudo crear solicitud')
    return await resp.json() as CommercialRequest
  } catch {
    return {
      id: crypto.randomUUID(), buyer_id: params.buyerId, producer_id: params.producerId, product_id: params.productId ?? null, message: params.message ?? null,
      status: 'pendiente', created_at: new Date().toISOString(), updated_at: null,
    }
  }
}

export async function listMyRequests(buyerId: string): Promise<CommercialRequest[]> {
  try {
    const resp = await apiFetch(`/api/requests/mine?buyerId=${encodeURIComponent(buyerId)}`)
    if (!resp.ok) throw new Error('No se pudo listar solicitudes')
    return await resp.json() as CommercialRequest[]
  } catch {
    return []
  }
}

export async function listIncomingRequests(producerId: string): Promise<CommercialRequest[]> {
  try {
    const resp = await apiFetch(`/api/requests/incoming?producerId=${encodeURIComponent(producerId)}`)
    if (!resp.ok) throw new Error('No se pudo listar solicitudes entrantes')
    return await resp.json() as CommercialRequest[]
  } catch {
    return []
  }
}

export async function updateRequestStatus(id: string, status: RequestStatus): Promise<void> {
  try {
    const resp = await apiFetch(`/api/requests/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (!resp.ok) throw new Error('No se pudo actualizar estado')
  } catch {
    // Silencio stub
  }
}