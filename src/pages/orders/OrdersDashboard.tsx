import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { Order, OrderFilters } from '../../services/ordersService'
import { exportOrderSummary, listOrdersForBuyer, listOrdersForSeller, updateOrderStatus } from '../../services/ordersService'
import { createReview } from '../../services/reviewsService'

const STATUS_LABELS: Record<Order['status'], string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  enviado: 'Enviado',
  entregado: 'Entregado',
  rechazado: 'Rechazado',
}

export default function OrdersDashboard(){
  const { user } = useAuth()
  const [role, setRole] = useState<'seller'|'buyer'>('seller')
  const [tab, setTab] = useState<'activos'|'historial'>('activos')
  const [filters, setFilters] = useState<OrderFilters>({ status: 'activos' })
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)

  const effectiveFilters = useMemo<OrderFilters>(()=>{
    const f: OrderFilters = { ...filters }
    if (tab === 'activos') f.status = 'activos'
    else f.status = 'todos' // luego filtraremos por estados de historial
    return f
  }, [filters, tab])

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const list = role === 'seller'
        ? await listOrdersForSeller(user.id, effectiveFilters)
        : await listOrdersForBuyer(user.id, effectiveFilters)
      const filtered = tab === 'historial'
        ? list.filter(o => o.status === 'entregado' || o.status === 'rechazado')
        : list.filter(o => ['pendiente','en_proceso','enviado'].includes(o.status))
      setOrders(filtered)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error cargando pedidos'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [user, role, effectiveFilters, tab])

  useEffect(()=>{ reload() }, [reload])

  const onChangeStatus = async (order: Order, newStatus: Order['status']) => {
    if (!user) return
    try {
      await updateOrderStatus(order.id, newStatus)
      await reload()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo actualizar el estado'
      alert(msg)
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-4">
      <h1 className="text-2xl font-bold text-green-700">Pedidos</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
        <RoleSwitch role={role} onChange={setRole} />
        <div className="mx-2 h-6 w-px bg-gray-200" />
        <Tabs tab={tab} onChange={setTab} />
        <div className="mx-2 h-6 w-px bg-gray-200" />
        <Filters filters={filters} onChange={setFilters} />
        <button onClick={reload} className="ml-auto inline-flex items-center gap-1 rounded-md border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-600 hover:text-white">
          <span className="material-icons-outlined text-base">refresh</span>
          Actualizar
        </button>
      </div>

      {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <section className="mt-4 overflow-hidden rounded-lg border bg-white">
        <header className="flex items-center justify-between border-b px-4 py-2">
          <h2 className="text-lg font-semibold">{tab === 'activos' ? 'Pedidos activos' : 'Historial de pedidos'}</h2>
          <span className="text-sm text-gray-600">{loading ? 'Cargando…' : `${orders.length} pedido(s)`}</span>
        </header>
        <ul className="divide-y">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs">#{o.id.slice(0,8)}</span>
                  <span>Producto: {o.product_id.slice(0,8)}…</span>
                  <span>Qty: {o.quantity}</span>
                  <span>Total: {(o.quantity * o.unit_price).toFixed(2)} {o.currency}</span>
                  <span>Creado: {new Date(o.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  {role==='seller' ? (
                    <>
                      <span className="text-gray-500">Comprador:</span> <span className="font-medium">{o.buyer_id.slice(0,8)}…</span>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-500">Vendedor:</span> <span className="font-medium">{o.seller_id.slice(0,8)}…</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={o.status} />
                {role==='seller' && tab==='activos' && (
                  <select
                    value={o.status}
                    onChange={(e)=> onChangeStatus(o, e.target.value as Order['status'])}
                    className="rounded border px-2 py-1 text-sm"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="enviado">Enviado</option>
                    <option value="entregado">Entregado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                )}
                <button onClick={()=> exportOrderSummary(o)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-gray-50">
                  <span className="material-icons-outlined text-base">download</span>
                  Resumen
                </button>
                {role==='buyer' && o.status==='entregado' && (
                  <ReviewInline productId={o.product_id} orderId={o.id} />
                )}
              </div>
            </li>
          ))}
          {!orders.length && !loading && (
            <li className="px-4 py-8 text-center text-sm text-gray-500">No hay pedidos para mostrar</li>
          )}
        </ul>
      </section>
    </main>
  )
}

function RoleSwitch({ role, onChange }: { role: 'seller'|'buyer'; onChange: (r: 'seller'|'buyer')=>void }){
  return (
    <div className="inline-flex items-center rounded-md border">
      <button onClick={()=> onChange('seller')} className={`px-3 py-1.5 text-sm ${role==='seller' ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>Como vendedor</button>
      <button onClick={()=> onChange('buyer')} className={`px-3 py-1.5 text-sm ${role==='buyer' ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>Como comprador</button>
    </div>
  )
}

function Tabs({ tab, onChange }: { tab: 'activos'|'historial'; onChange: (t: 'activos'|'historial')=>void }){
  return (
    <div className="inline-flex items-center rounded-md border">
      <button onClick={()=> onChange('activos')} className={`px-3 py-1.5 text-sm ${tab==='activos' ? 'bg-green-100 text-green-800' : 'text-gray-700 hover:bg-gray-50'}`}>Activos</button>
      <button onClick={()=> onChange('historial')} className={`px-3 py-1.5 text-sm ${tab==='historial' ? 'bg-green-100 text-green-800' : 'text-gray-700 hover:bg-gray-50'}`}>Historial</button>
    </div>
  )
}

function Filters({ filters, onChange }: { filters: OrderFilters; onChange: (f: OrderFilters)=>void }){
  const toDateInput = (iso?: string) => iso ? new Date(iso).toISOString().slice(0,10) : ''
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm text-gray-600">Estado:</label>
      <select
        value={filters.status ?? 'activos'}
        onChange={(e)=> onChange({ ...filters, status: e.target.value as OrderFilters['status'] })}
        className="rounded border px-2 py-1 text-sm"
      >
        <option value="activos">Activos</option>
        <option value="todos">Todos</option>
        <option value="pendiente">Pendiente</option>
        <option value="en_proceso">En proceso</option>
        <option value="enviado">Enviado</option>
        <option value="entregado">Entregado</option>
        <option value="rechazado">Rechazado</option>
      </select>
      <label className="ml-2 text-sm text-gray-600">Desde:</label>
      <input type="date" className="rounded border px-2 py-1 text-sm" value={toDateInput(filters.from)} onChange={(e)=> onChange({ ...filters, from: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
      <label className="text-sm text-gray-600">Hasta:</label>
      <input type="date" className="rounded border px-2 py-1 text-sm" value={toDateInput(filters.to)} onChange={(e)=> onChange({ ...filters, to: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
    </div>
  )
}

function StatusPill({ status }: { status: Order['status'] }){
  const color = status === 'pendiente' ? 'bg-yellow-100 text-yellow-800'
    : status === 'en_proceso' ? 'bg-blue-100 text-blue-800'
    : status === 'enviado' ? 'bg-indigo-100 text-indigo-800'
    : status === 'entregado' ? 'bg-green-100 text-green-800'
    : 'bg-red-100 text-red-800'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{STATUS_LABELS[status]}</span>
}

function ReviewInline({ productId }: { productId: string; orderId: string }){
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setStatus(null)
    if (comment.trim().length < 10) { setStatus('El comentario debe tener al menos 10 caracteres.'); return }
    if (comment.trim().length > 300) { setStatus('El comentario no puede exceder 300 caracteres.'); return }
    if (!user) return
    try {
      setSaving(true)
      await createReview({ productId, userId: user.id, rating, comment })
      setStatus('¡Gracias por tu reseña!')
      setOpen(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo enviar la reseña'
      setStatus(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button onClick={()=> setOpen(v=>!v)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-gray-50">
        <span className="material-icons-outlined text-base">rate_review</span>
        Calificar
      </button>
      {open && (
        <div className="z-10 mt-2 rounded-md border bg-white p-3 shadow">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Puntaje:</label>
            <select value={rating} onChange={(e)=> setRating(Number(e.target.value))} className="rounded border px-2 py-1 text-sm">
              {[1,2,3,4,5].map(n=> <option key={n} value={n}>{n} ⭐</option>)}
            </select>
          </div>
          <textarea value={comment} onChange={(e)=> setComment(e.target.value)} placeholder="Escribe tu comentario (10-300 caracteres)"
            className="mt-2 w-64 rounded border px-2 py-1 text-sm" rows={3} />
          <div className="mt-2 flex items-center gap-2">
            <button disabled={saving} onClick={submit} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Enviar</button>
            <button onClick={()=> setOpen(false)} className="rounded-md border px-3 py-1.5 text-sm">Cancelar</button>
            {status && <span className="text-xs text-gray-600">{status}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
