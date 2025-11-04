import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listConversations, getConversationsParticipants, getUnreadCountByConversation } from '../services/messagingService'
import { fetchUsersInfo, type PublicUserInfo } from '../services/userInfoService'

type Item = { cid: string; other?: PublicUserInfo; unread: number }

export default function MessagesWidget(){
  const { user } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [totalUnread, setTotalUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    (async ()=>{
      if (!user) { setItems([]); setTotalUnread(0); setLoading(false); return }
      setLoading(true)
      try {
        const convs = await listConversations(user.id)
        const ids = convs.map(c=>c.id)
        const partsMap = await getConversationsParticipants(ids, user.id)
        const uniqueOtherIds = Array.from(new Set(Object.values(partsMap).flat()))
        const usersMap = uniqueOtherIds.length ? await fetchUsersInfo(uniqueOtherIds) : {}
        const unreadMap = await getUnreadCountByConversation(user.id)
        const list: Item[] = convs.map(c => ({
          cid: c.id,
          other: (partsMap[c.id] && partsMap[c.id][0]) ? usersMap[partsMap[c.id][0]] : undefined,
          unread: unreadMap[c.id] || 0,
        }))
        list.sort((a,b)=> (b.unread - a.unread))
        setItems(list)
        setTotalUnread(Object.values(unreadMap).reduce((acc, n)=> acc + (n||0), 0))
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

  if (!user) return null

  return (
    <section aria-label="Resumen de mensajes" className="rounded border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-green-700">chat</span>
          <h2 className="text-base font-semibold text-green-700">Tus mensajes</h2>
        </div>
        {totalUnread > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">
            {totalUnread} sin leer
          </span>
        )}
      </div>
      {loading ? (
        <div className="text-sm text-gray-600">Cargando mensajes…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-600">Aún no tienes mensajes. Cuando alguien te escriba, los verás aquí.</div>
      ) : (
        <ul className="space-y-2">
          {items.slice(0,3).map(it => (
            <li key={it.cid} className="flex items-center justify-between rounded border px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{it.other?.full_name || it.other?.email || `Chat ${it.cid.slice(0,6)}`}</div>
                {it.unread > 0 ? (
                  <div className="mt-0.5 text-xs text-gray-600">{it.unread} mensajes sin leer</div>
                ) : (
                  <div className="mt-0.5 text-xs text-gray-500">Al día</div>
                )}
              </div>
              <a href={`/messages?with=${encodeURIComponent(it.other?.id || '')}`} className="ml-3 inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700">
                Abrir chat
                <span className="material-icons-outlined text-[16px]">arrow_forward</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <a href="/messages" className="inline-flex w-full items-center justify-center gap-2 rounded border border-green-600 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50">
          Ver todos los mensajes
        </a>
      </div>
    </section>
  )
}
