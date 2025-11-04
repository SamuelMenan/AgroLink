import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { CommercialRequest } from '../../services/requestService'
import { listMyRequests } from '../../services/requestService'

export default function MyRequests() {
  const { user } = useAuth()
  const [items, setItems] = useState<CommercialRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)

  useEffect(()=>{
    let alive = true
    async function load(){
      if (!user) return
      setLoading(true); setError(null)
      try {
        const res = await listMyRequests(user.id)
        if (!alive) return
        setItems(res)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error cargando solicitudes'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
    return ()=>{ alive=false }
  }, [user])

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-green-800">Mis solicitudes comerciales</h1>
      {error && <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="mt-6 space-y-2">
          {Array.from({length:5}).map((_,i)=> <div key={i} className="h-16 animate-pulse rounded border bg-gray-50" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded border bg-white p-6 text-gray-600">Aún no has enviado solicitudes.</div>
      ) : (
        <ul className="mt-6 divide-y rounded border bg-white">
          {items.map(r => (
            <li key={r.id} className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-12 sm:items-center">
              <div className="sm:col-span-6">
                <p className="font-medium">Solicitud a productor</p>
                <p className="text-sm text-gray-600">{r.message || '—'}</p>
              </div>
              <div className="sm:col-span-3 text-sm">{new Date(r.created_at).toLocaleString()}</div>
              <div className="sm:col-span-3">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(r.status)}`}>{r.status}</span>
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
