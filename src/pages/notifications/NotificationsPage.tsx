import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { NotificationItem } from '../../services/notificationService'
import { deleteNotification, listRecentNotifications, markAllAsRead, markAsRead } from '../../services/notificationService'

export default function NotificationsPage(){
  const { user } = useAuth()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(()=>{
    let alive = true
    async function run(){
      if (!user) {
        if (!alive) return
        setItems([])
        setError(null)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const list = await listRecentNotifications(user.id, 100)
        if (!alive) return
        setItems(list)
        setError(null)
      } catch (err) {
        console.error('[NotificationsPage] listRecentNotifications failed', err)
        if (!alive) return
        setItems([])
        setError('No se pudieron cargar tus notificaciones. Intenta nuevamente más tarde.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return ()=>{ alive = false }
  }, [user])

  if (!user) return <main className="mx-auto max-w-3xl p-4">Inicia sesión</main>

  return (
    <main className="mx-auto max-w-3xl p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-700">Notificaciones</h1>
        <button onClick={async ()=>{
          try {
            await markAllAsRead(user.id)
            setItems(it=>it.map(n=> ({...n, read_at: n.read_at || new Date().toISOString()})))
            setError(null)
          } catch (err) {
            console.error('[NotificationsPage] markAllAsRead failed', err)
            setError('No pudimos marcar todas las notificaciones como leídas.')
          }
        }} className="rounded-md border px-3 py-1.5 text-sm text-green-700 hover:bg-green-50">Marcar todas como leídas</button>
      </div>
      <div className="mt-4 divide-y rounded-xl border bg-white">
        {loading ? (
          <div className="p-6 text-gray-600">Cargando…</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-gray-600">No tienes notificaciones</div>
        ) : items.map(n => (
          <div key={n.id} className={`flex items-start gap-3 p-4 ${!n.read_at ? 'bg-orange-50/40' : ''}`}>
            <span className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${dotColor(n.type)}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{n.title}</p>
              {n.body && <p className="truncate text-sm text-gray-700">{n.body}</p>}
              <p className="mt-0.5 text-xs text-gray-500">{new Date(n.created_at).toLocaleString()}</p>
              <div className="mt-2 flex gap-2">
                {n.url && <a href={n.url} className="rounded-md border border-green-600 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-600 hover:text-white">Abrir</a>}
                {!n.read_at && <button onClick={async ()=>{
                  try {
                    await markAsRead(n.id)
                    setItems(it=>it.map(x=> x.id===n.id? {...x, read_at: new Date().toISOString()} : x))
                    setError(null)
                  } catch (err) {
                    console.error('[NotificationsPage] markAsRead failed', err)
                    setError('No se pudo marcar la notificación como leída.')
                  }
                }} className="rounded-md border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">Marcar leída</button>}
                <button onClick={async ()=>{
                  try {
                    await deleteNotification(n.id)
                    setItems(it=>it.filter(x=>x.id!==n.id))
                    setError(null)
                  } catch (err) {
                    console.error('[NotificationsPage] deleteNotification failed', err)
                    setError('No se pudo eliminar la notificación.')
                  }
                }} className="rounded-md border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

function dotColor(type: string){
  return type === 'request_new' ? 'bg-blue-500' : type === 'request_update' ? 'bg-green-500' : type === 'message' ? 'bg-purple-500' : 'bg-gray-400'
}
