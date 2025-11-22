import { apiFetch } from './apiClient'

export type Order = {
  id: string
  product_id: string
  seller_id: string
  buyer_id: string
  quantity: number
  unit_price: number
  currency: string
  status: 'pendiente' | 'en_proceso' | 'enviado' | 'entregado' | 'rechazado'
  notes?: string | null
  created_at: string
  updated_at: string
}

export type OrderFilters = {
  status?: Order['status'] | 'activos' | 'todos'
  from?: string
  to?: string
}

export async function createOrder(input: { product_id: string; seller_id: string; buyer_id: string; quantity: number; unit_price: number; currency?: string; notes?: string }): Promise<Order> {
  const now = new Date().toISOString()
  const payload = {
    product_id: input.product_id,
    seller_id: input.seller_id,
    buyer_id: input.buyer_id,
    quantity: input.quantity,
    unit_price: input.unit_price,
    currency: input.currency || 'USD',
    status: 'pendiente',
    notes: input.notes || null,
    created_at: now,
    updated_at: now
  }
  const res = await apiFetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error('Error creando orden')
  const data = await res.json()
  return Array.isArray(data) ? data[0] as Order : data as Order
}

export async function listOrdersForSeller(sellerId: string, filters: OrderFilters = {}): Promise<Order[]> {
  const params: string[] = ['select=*', `seller_id=eq.${sellerId}`, 'order=created_at.desc']
  if (filters.status && filters.status !== 'todos') {
    if (filters.status === 'activos') {
      params.push('or=status.eq.pendiente,status.eq.en_proceso,status.eq.enviado')
    } else {
      params.push(`status=eq.${filters.status}`)
    }
  }
  if (filters.from) params.push(`created_at=gte.${filters.from}`)
  if (filters.to) params.push(`created_at=lte.${filters.to}`)
  const q = params.join('&')
  const res = await apiFetch(`/api/orders?q=${encodeURIComponent(q)}`)
  if (!res.ok) {
    try { console.warn('Pedidos: respuesta no OK para vendedor', res.status) } catch {}
    return []
  }
  return await res.json() as Order[]
}

export async function listOrdersForBuyer(buyerId: string, filters: OrderFilters = {}): Promise<Order[]> {
  const params: string[] = ['select=*', `buyer_id=eq.${buyerId}`, 'order=created_at.desc']
  if (filters.status && filters.status !== 'todos') {
    if (filters.status === 'activos') {
      params.push('or=status.eq.pendiente,status.eq.en_proceso,status.eq.enviado')
    } else {
      params.push(`status=eq.${filters.status}`)
    }
  }
  if (filters.from) params.push(`created_at=gte.${filters.from}`)
  if (filters.to) params.push(`created_at=lte.${filters.to}`)
  const q = params.join('&')
  const res = await apiFetch(`/api/orders?q=${encodeURIComponent(q)}`)
  if (!res.ok) {
    try { console.warn('Pedidos: respuesta no OK para comprador', res.status) } catch {}
    return []
  }
  return await res.json() as Order[]
}

export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
  const res = await apiFetch(`/api/orders/${orderId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
  if (!res.ok) throw new Error('Error actualizando estado orden')
}

export function exportOrderSummary(order: Order) {
  const total = order.quantity * order.unit_price
  const lines = [
    `Pedido ${order.id}`,
    `Estado: ${order.status}`,
    `Vendedor: ${order.seller_id}`,
    `Comprador: ${order.buyer_id}`,
    `Cantidad: ${order.quantity}`,
    `Precio unit: ${order.unit_price} ${order.currency}`,
    `Total: ${total} ${order.currency}`,
    `Creado: ${new Date(order.created_at).toLocaleString()}`,
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pedido-${order.id}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// Legacy uuid import retained for future client-only IDs if needed
