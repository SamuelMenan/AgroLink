import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { NotificationItem } from '../services/notificationService'
import { deleteNotification, getUnreadCount, listRecentNotifications, markAllAsRead, markAsRead, subscribeNotifications } from '../services/notificationService'
import { Link } from 'react-router-dom'

export default function NotificationsBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [highlight, setHighlight] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(()=>{
    function onClickOutside(e: MouseEvent){
      if (!panelRef.current) return
      if (!panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onClickOutside)
    return ()=> document.removeEventListener('click', onClickOutside)
  }, [])

  useEffect(()=>{
    let off: (()=>void)|null = null
    async function init(){
      if (!user) return
      const [cnt, recent] = await Promise.all([
        getUnreadCount(user.id),
        listRecentNotifications(user.id, 12),
      ])
      setUnread(cnt)
      setItems(recent)
      off = subscribeNotifications(user.id, (n)=>{
        setItems((prev)=> [n, ...prev].slice(0, 12))
        setUnread((u)=> u + 1)
        // pequeño highlight visual cuando llega algo nuevo
        setHighlight(true)
        setTimeout(()=> setHighlight(false), 800)
      })
    }
    init()
    return ()=>{ if (off) off() }
  }, [user])

  // Auto-marcar como leídas al abrir el panel
  useEffect(()=>{
    if (!user) return
    if (!open) return
    (async ()=>{
      await markAllAsRead(user.id)
      setUnread(0)
      setItems((it)=> it.map(n=> ({...n, read_at: n.read_at || new Date().toISOString()})))
    })()
  }, [open, user])

  if (!user) return null

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={()=> setOpen((o)=>!o)} aria-label="Notificaciones" className={`relative rounded-full p-2 transition ${highlight ? 'ring-2 ring-orange-400' : ''} hover:bg-green-50`}>
        <span className={`material-icons-outlined align-middle ${unread>0 ? 'text-orange-600' : 'text-gray-700'}`}>notifications</span>
        {unread>0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold text-gray-800">Notificaciones</span>
            <div className="flex items-center gap-2">
              <button onClick={async ()=>{ await markAllAsRead(user.id); setUnread(0); setItems((it)=> it.map(n=> ({...n, read_at: n.read_at || new Date().toISOString()}))) }} className="text-xs text-green-700 hover:underline">Marcar todas como leídas</button>
              <Link to="/dashboard/notifications" className="text-xs text-green-700 hover:underline">Ver todas</Link>
            </div>
          </div>
          <ul className="max-h-96 divide-y overflow-auto">
            {items.length === 0 ? (
              <li className="p-4 text-sm text-gray-600">No tienes notificaciones nuevas</li>
            ) : items.map(n => (
              <li key={n.id} className={`flex items-start gap-3 px-3 py-3 ${!n.read_at ? 'bg-orange-50/50' : ''}`}>
                <TypeDot type={n.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{n.title}</p>
                  {n.body && <p className="truncate text-xs text-gray-600">{n.body}</p>}
                  <p className="mt-0.5 text-[10px] text-gray-500">{formatDate(n.created_at)}</p>
                  <div className="mt-2 flex gap-2">
                    {n.url && <Link to={n.url} className="rounded-md border border-green-600 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-600 hover:text-white">Abrir</Link>}
                    {!n.read_at && <button onClick={async ()=>{ await markAsRead(n.id); setUnread(Math.max(0, unread-1)); setItems((it)=> it.map(x=> x.id===n.id? {...x, read_at: new Date().toISOString()} : x)) }} className="rounded-md border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">Marcar leída</button>}
                    <button onClick={async ()=>{ await deleteNotification(n.id); setItems((it)=> it.filter(x=>x.id!==n.id)); if(!n.read_at) setUnread(Math.max(0, unread-1)) }} className="rounded-md border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">Eliminar</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function TypeDot({ type }: { type: string }){
  const color = type === 'request_new' ? 'bg-blue-500' : type === 'request_update' ? 'bg-green-500' : type === 'message' ? 'bg-purple-500' : 'bg-gray-400'
  return <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
}

function formatDate(iso: string){
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch { return iso }
}
