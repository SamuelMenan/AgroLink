import { isSupabaseEnabled, supabase } from './supabaseClient'
import { v4 as uuidv4 } from './uuid'

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
  const base: Omit<Order, 'id'> = {
    product_id: input.product_id,
    seller_id: input.seller_id,
    buyer_id: input.buyer_id,
    quantity: input.quantity,
    unit_price: input.unit_price,
    currency: input.currency || 'USD',
    status: 'pendiente',
    notes: input.notes || null,
    created_at: now,
    updated_at: now,
  }
  if (!isSupabaseEnabled()) {
    // mock: store in memory per session
    const id = uuidv4()
    const item: Order = { id, ...base }
    const list = getLocal()
    list.push(item)
    setLocal(list)
    return item
  }
  const { data, error } = await supabase.from('orders').insert(base).select('*').single()
  if (error) throw new Error(error.message)
  return data as Order
}

export async function listOrdersForSeller(sellerId: string, filters: OrderFilters = {}): Promise<Order[]> {
  if (!isSupabaseEnabled()) {
    let list = getLocal().filter(o => o.seller_id === sellerId)
    list = filterOrders(list, filters)
    return sortByDateDesc(list)
  }
  let q = supabase.from('orders').select('*').eq('seller_id', sellerId)
  if (filters.status && filters.status !== 'todos') {
    if (filters.status === 'activos') q = q.in('status', ['pendiente','en_proceso','enviado'])
    else q = q.eq('status', filters.status)
  }
  if (filters.from) q = q.gte('created_at', filters.from)
  if (filters.to) q = q.lte('created_at', filters.to)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Order[]
}

export async function listOrdersForBuyer(buyerId: string, filters: OrderFilters = {}): Promise<Order[]> {
  if (!isSupabaseEnabled()) {
    let list = getLocal().filter(o => o.buyer_id === buyerId)
    list = filterOrders(list, filters)
    return sortByDateDesc(list)
  }
  let q = supabase.from('orders').select('*').eq('buyer_id', buyerId)
  if (filters.status && filters.status !== 'todos') {
    if (filters.status === 'activos') q = q.in('status', ['pendiente','en_proceso','enviado'])
    else q = q.eq('status', filters.status)
  }
  if (filters.from) q = q.gte('created_at', filters.from)
  if (filters.to) q = q.lte('created_at', filters.to)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Order[]
}

export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
  if (!isSupabaseEnabled()) {
    const list = getLocal()
    const idx = list.findIndex(o=>o.id===orderId)
    if (idx>=0) { list[idx] = { ...list[idx], status, updated_at: new Date().toISOString() }; setLocal(list) }
    return
  }
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
  if (error) throw new Error(error.message)
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

// ---------- local mock helpers ----------
let _orders: Order[] = []
function getLocal(){ return _orders }
function setLocal(v: Order[]){ _orders = v }
function filterOrders(list: Order[], f: OrderFilters){
  let out = [...list]
  if (f.status && f.status !== 'todos') {
    if (f.status === 'activos') out = out.filter(o=> ['pendiente','en_proceso','enviado'].includes(o.status))
    else out = out.filter(o=> o.status === f.status)
  }
  if (f.from) out = out.filter(o=> o.created_at >= f.from!)
  if (f.to) out = out.filter(o=> o.created_at <= f.to!)
  return out
}
function sortByDateDesc(list: Order[]){ return [...list].sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }
