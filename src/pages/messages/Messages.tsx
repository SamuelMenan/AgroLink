import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { DecryptedMessage } from '../../services/messagingService'
import { ensureConversationWith, listConversations, loadMessages, markDelivered, markRead, sendMessage, subscribeMessages, subscribeTyping, sendTyping, getConversationsParticipants, getUnreadCountByConversation, sendAttachment } from '../../services/messagingService'
import { fetchUsersInfo, type PublicUserInfo } from '../../services/userInfoService'

export default function Messages(){
  const { user } = useAuth()
  const [params] = useSearchParams()
  const withUser = params.get('with')
  const [convId, setConvId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Array<{id:string, other?: PublicUserInfo, unread?: number}>>([])
  const [msgs, setMsgs] = useState<DecryptedMessage[]>([])
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement|null>(null)
  const [someoneTyping, setSomeoneTyping] = useState(false)
  const typingClearRef = useRef<number|undefined>(undefined)
  const lastTypingSentRef = useRef<number>(0)

  useEffect(()=>{
    (async ()=>{
      if (!user) return
      if (withUser) {
        const conv = await ensureConversationWith(user.id, withUser)
        setConvId(conv.id)
      }
      const convs = await listConversations(user.id)
      const convIds = convs.map(c=>c.id)
      // Participants mapping per conversation
      const partsMap = await getConversationsParticipants(convIds, user.id)
      const uniqueOtherIds = Array.from(new Set(Object.values(partsMap).flat()))
      const usersMap = uniqueOtherIds.length ? await fetchUsersInfo(uniqueOtherIds) : {}
      const unreadMap = await getUnreadCountByConversation(user.id)
      const mapped = convs.map(c => ({
        id: c.id,
        other: (partsMap[c.id] && partsMap[c.id][0]) ? usersMap[partsMap[c.id][0]] : undefined,
        unread: unreadMap[c.id] || 0
      }))
      setConversations(mapped)
      // Selección automática de la primera conversación si no hay selección
      if (!withUser && !convId && mapped.length > 0) {
        setConvId(mapped[0].id)
      }
    })()
  }, [user, withUser, convId])

  useEffect(()=>{
    if (!user || !convId) return
    let off: (()=>void)|undefined
    ;(async ()=>{
      const list = await loadMessages(user.id, convId)
      setMsgs(list)
      scrollBottom()
      // mark delivered for messages not mine
      const notMine = list.filter(m => m.sender_id !== user.id).map(m=>m.id)
      await markDelivered(user.id, notMine)
  off = subscribeMessages(convId, async () => {
        // naive refresh; in a complete impl decrypt single message
        const updated = await loadMessages(user.id, convId)
        setMsgs(updated)
        scrollBottom()
        const others = updated.filter(x=> x.sender_id !== user.id).map(x=>x.id)
        await markDelivered(user.id, others)
      })
    })()
    return ()=> { if (off) off() }
  }, [user, convId])

  // typing indicator subscription
  useEffect(()=>{
    if (!user || !convId) return
    const off = subscribeTyping(convId, ({ userId }) => {
      if (userId === user.id) return
      setSomeoneTyping(true)
      if (typingClearRef.current) window.clearTimeout(typingClearRef.current)
      typingClearRef.current = window.setTimeout(()=> setSomeoneTyping(false), 2000)
    })
    return ()=> { if (off) off() }
  }, [user, convId])

  function scrollBottom(){
    requestAnimationFrame(()=>{ if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight })
  }

  async function onSend(){
    if (!user || !convId || !text.trim()) return
    const t = text
    setText('')
    await sendMessage(convId, user.id, t)
  }

  function maybeSendTyping(){
    if (!user || !convId) return
    const now = Date.now()
    if (now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now
      // fire and forget
      void sendTyping(convId, user.id)
    }
  }

  useEffect(()=>{
    // mark read when messages are visible
    if (!user || !msgs.length) return
    const others = msgs.filter(x=> x.sender_id !== user.id).map(x=>x.id)
    markRead(user.id, others)
  }, [user, msgs])

  // Conversación actual (para mostrar acciones como WhatsApp)
  const current = conversations.find(c => c.id === convId)

  return (
    <main className="mx-auto flex h-[calc(100vh-56px)] max-w-6xl gap-4 p-4">
      {/* Sidebar (oculto en móvil) */}
      <aside className="hidden w-80 flex-shrink-0 flex-col rounded-2xl border bg-white p-3 sm:flex">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="text-base font-bold text-gray-800">Conversaciones</div>
          <span className="material-icons-outlined text-gray-500">chat_bubble</span>
        </div>
        <div className="mt-2 flex-1 overflow-auto">
          {conversations.length===0 ? (
            <div className="p-3 text-sm text-gray-600">Aún no tienes conversaciones.</div>
          ) : conversations.map(c => (
            <button key={c.id} onClick={()=> { setConvId(c.id); setConversations(prev=> prev.map(x=> x.id===c.id ? { ...x, unread: 0 } : x)) }} className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-green-50 ${convId===c.id?'bg-green-50':''}`}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                  {(c.other?.full_name || c.other?.email || 'C').slice(0,1).toUpperCase()}
                </span>
                <span className="truncate">{c.other?.full_name || c.other?.email || `Chat ${c.id.slice(0,6)}`}</span>
              </span>
              {c.unread && c.unread>0 ? (
                <span className="ml-2 inline-flex min-w-[24px] items-center justify-center rounded-full bg-green-600 px-1.5 text-[11px] font-semibold text-white">{c.unread}</span>
              ) : null}
            </button>
          ))}
        </div>
      </aside>

      {/* Chat principal */}
      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/simple" className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 sm:hidden">
              <span className="material-icons-outlined text-[18px]">arrow_back</span>
              Atrás
            </Link>
            <div className="text-lg font-bold text-gray-800">Mensajes</div>
          </div>
            <div className="flex items-center gap-2">
              {/* Botón WhatsApp con advertencia */}
              <WhatsAppWarnButton
                phone={current?.other?.phone || null}
                displayName={current?.other?.full_name || current?.other?.email || 'Contacto'}
              />
              {/* Selector móvil si no hay conversación */}
          {!convId && conversations.length>0 && (
            <div className="sm:hidden">
              <select aria-label="Elegir conversación" className="rounded-lg border px-2 py-1 text-sm" onChange={(e)=> setConvId(e.target.value)} value="">
                <option value="" disabled>Elige un chat</option>
                {conversations.map(c=> (
                  <option key={c.id} value={c.id}>{c.other?.full_name || c.other?.email || `Chat ${c.id.slice(0,6)}`}</option>
                ))}
              </select>
            </div>
          )}
            </div>
        </div>
        <div ref={listRef} className="flex-1 space-y-3 overflow-auto p-4">
          {(!convId && conversations.length===0) && (
            <div className="mx-auto max-w-md rounded-xl border bg-white p-6 text-center text-gray-700">
              <span className="material-icons-outlined mx-auto mb-2 block text-4xl text-green-700">chat</span>
              <div className="text-lg font-semibold">Aún no tienes mensajes</div>
              <div className="mt-1 text-sm">Cuando alguien te escriba, lo verás aquí. Puedes empezar desde “Solicitudes”.</div>
            </div>
          )}

          {msgs.map(m => (
            <div key={m.id} className={`max-w-[80%] rounded-2xl px-4 py-3 text-base shadow-sm ${m.sender_id===user?.id ? 'ml-auto bg-green-600 text-white' : 'bg-white text-gray-900 border'}`}>
              <div className="whitespace-pre-wrap break-words">{m.content}</div>
              <div className={`mt-1 flex items-center gap-1 text-[11px] ${m.sender_id===user?.id ? 'opacity-90' : 'opacity-70'}`}>
                <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {m.sender_id===user?.id && (
                  m.status==='read' ? (
                    <span className="material-icons-outlined text-[16px] opacity-100">done_all</span>
                  ) : m.status==='delivered' ? (
                    <span className="material-icons-outlined text-[16px] opacity-80">done_all</span>
                  ) : (
                    <span className="material-icons-outlined text-[16px] opacity-70">done</span>
                  )
                )}
              </div>
            </div>
          ))}

          {someoneTyping && (
            <div className="inline-flex max-w-[75%] items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
              <span className="material-icons-outlined text-[16px]">keyboard</span>
              Escribiendo…
            </div>
          )}
        </div>

        <div className="border-t p-3">
          <div className="flex items-center gap-2">
            <AttachmentControl onPick={async (file)=>{ if (!user || !convId || !file) return; await sendAttachment(convId, user.id, file) }} />
            <input aria-label="Escribe tu mensaje" value={text} onChange={(e)=>{ setText(e.target.value); maybeSendTyping() }} onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); onSend() } else { maybeSendTyping() } }} placeholder="Escribe tu mensaje aquí" className="w-full rounded-xl border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-green-600/20" />
            <button onClick={onSend} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700">
              <span className="material-icons-outlined text-[20px]">send</span>
              Enviar
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

function AttachmentControl({ onPick }: { onPick: (file: File | null)=>void }){
  const inputRef = useRef<HTMLInputElement|null>(null)
  return (
    <>
      <input ref={inputRef} type="file" accept="*/*" className="hidden" onChange={(e)=>{
        const f = e.target.files && e.target.files[0] ? e.target.files[0] : null
        onPick(f)
        if (inputRef.current) inputRef.current.value = ''
      }} />
      <button type="button" onClick={()=> inputRef.current?.click()} className="inline-flex items-center justify-center rounded border px-2 py-2 text-gray-700 hover:bg-gray-50">
        <span className="material-icons-outlined text-[18px]">attach_file</span>
      </button>
    </>
  )
}

function WhatsAppWarnButton({ phone, displayName }: { phone: string | null; displayName: string }){
  const [open, setOpen] = useState(false)
  const cleanNumber = (phone || '').replace(/\D/g, '')
  const disabled = !cleanNumber
  const prefill = `Hola ${displayName}, te escribo desde AgroLink.`
  const waHref = cleanNumber ? `https://wa.me/${cleanNumber}?text=${encodeURIComponent(prefill)}` : '#'
  return (
    <>
      <button
        type="button"
        onClick={()=> !disabled && setOpen(true)}
        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-sm ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'}`}
        title={disabled ? 'Este contacto no tiene número disponible' : 'Chatear por WhatsApp'}
        aria-disabled={disabled}
      >
        <span className="material-icons-outlined text-[18px] text-green-600">whatsapp</span>
        WhatsApp
      </button>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-amber-600">warning</span>
              <h3 className="text-base font-semibold text-gray-900">Advertencia</h3>
            </div>
            <p className="mt-2 text-sm text-gray-700">
              Si sales de la aplicación para hablar en WhatsApp, podrías ser víctima de estafas u otros problemas en internet.
              Verifica la identidad de la persona y nunca compartas datos sensibles.
            </p>
            <p className="mt-2 text-sm text-gray-700">Número: <span className="font-mono">{cleanNumber || 'No disponible'}</span></p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={()=> setOpen(false)} className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <a href={waHref} target="_blank" rel="noopener noreferrer" onClick={()=> setOpen(false)} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
                Continuar a WhatsApp
                <span className="material-icons-outlined text-[18px]">open_in_new</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
