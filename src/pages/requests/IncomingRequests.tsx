import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { CommercialRequest } from '../../services/requestService'
import { listIncomingRequests, updateRequestStatus } from '../../services/requestService'
import { fetchUsersInfo, type PublicUserInfo } from '../../services/userInfoService'
import WhatsAppWarnButton from '../../components/WhatsAppWarnButton'

export default function IncomingRequests() {
  const { user } = useAuth()
  type IncomingRequestItem = CommercialRequest & { buyer?: PublicUserInfo }
  const [items, setItems] = useState<IncomingRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)

  const reload = useCallback(async ()=>{
    if (!user) return
    setLoading(true); setError(null)
    try {
      const res = await listIncomingRequests(user.id)
      // Enriquecer con info del solicitante
      let users: Record<string, PublicUserInfo> = {}
      try {
        const ids = Array.from(new Set(res.map(r => r.buyer_id)))
        users = await fetchUsersInfo(ids)
      } catch (err) {
        console.warn('No se pudo cargar info de usuarios', err)
      }
      setItems(res.map(r => ({ ...r, buyer: users[r.buyer_id] })))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error cargando solicitudes'
      setError(msg)
    } finally { setLoading(false) }
  }, [user])

  useEffect(()=>{ reload() }, [reload])

  async function act(id: string, status: 'aceptada'|'rechazada'){
    await updateRequestStatus(id, status)
    await reload()
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-green-800">Solicitudes recibidas</h1>
      {error && <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="mt-6 space-y-2">
          {Array.from({length:5}).map((_,i)=> <div key={i} className="h-16 animate-pulse rounded border bg-gray-50" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded border bg-white p-6 text-gray-600">No tienes solicitudes pendientes.</div>
      ) : (
        <ul className="mt-6 divide-y rounded border bg-white">
          {items.map(r => (
            <li key={r.id} className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-12 sm:items-center">
              <div className="sm:col-span-6">
                <p className="font-medium flex items-center gap-2">
                  <span className="material-icons-outlined text-gray-600">person</span>
                  { r.buyer?.full_name || r.buyer?.email || 'Comprador' }
                  <span className="text-xs text-gray-500">{ r.buyer?.location ? ` • ${ r.buyer.location }` : '' }</span>
                </p>
                <p className="text-sm text-gray-600">{r.message || '—'}</p>
              </div>
              <div className="sm:col-span-3 text-sm">{new Date(r.created_at).toLocaleString()}</div>
              <div className="sm:col-span-3 flex flex-wrap gap-2">
                {r.status === 'pendiente' ? (
                  <>
                    <button onClick={()=>act(r.id,'aceptada')} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700">Aceptar</button>
                    <button onClick={()=>act(r.id,'rechazada')} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">Rechazar</button>
                    {r.buyer && (
                      <a href={`/messages?with=${r.buyer.id}`} className="rounded-md border border-green-600 px-3 py-1.5 text-sm font-semibold text-green-700 hover:bg-green-600 hover:text-white">Chatear</a>
                    )}
                    {r.buyer && (
                      <WhatsAppWarnButton phone={r.buyer.phone ?? null} displayName={r.buyer.full_name || r.buyer.email || 'Contacto'} size="md" />
                    )}
                  </>
                ) : (
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(r.status)}`}>{r.status}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function badgeClass(st: string){
  if (st === 'pendiente') return 'bg-amber-100 text-amber-800'
  if (st === 'aceptada') return 'bg-green-100 text-green-800'
  return 'bg-red-100 text-red-800'
}
