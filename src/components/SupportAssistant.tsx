import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/apiClient'

export default function SupportAssistant(){
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<{ role: 'assistant' | 'user'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [speaking, setSpeaking] = useState(false)

  const canSpeak = typeof window !== 'undefined' && !!window.speechSynthesis
  const utter = useMemo(() => {
    if (!canSpeak || messages.length === 0) return null
    const last = messages[messages.length - 1]
    const u = new SpeechSynthesisUtterance(last.content)
    u.lang = 'es-ES'
    u.rate = 1
    u.onend = () => setSpeaking(false)
    return u
  }, [messages, canSpeak])

  useEffect(() => {
    if (!open || messages.length) return
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const res = await apiFetch('/api/v1/ai/assist/support', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userName: user?.full_name || user?.email || '' }),
        })
        const data = await res.json()
        const text = data.output_text || 'Hola, ¿en qué puedo ayudarte?'
        setMessages([{ role: 'assistant', content: text }])
      } catch (e: any) { setError(e?.message || 'No se pudo cargar el asistente') } finally { setLoading(false) }
    })()
  }, [open, user, messages.length])

  function toggleSpeak(){
    if (!canSpeak || !utter) return
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false) }
    else { setSpeaking(true); window.speechSynthesis.speak(utter) }
  }

  async function send(q?: string){
    const text = (q ?? input).trim()
    if (!text) return
    setMessages(m => [...m, { role: 'user', content: text }])
    setInput(''); setLoading(true); setError(null)
    try {
      const res = await apiFetch('/api/v1/ai/assist/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: user?.full_name || user?.email || '', question: text }),
      })
      const data = await res.json()
      const out = data.output_text || 'No tengo respuesta en este momento.'
      setMessages(m => [...m, { role: 'assistant', content: out }])
    } catch (e: any) { setError(e?.message || 'Fallo la respuesta. Intenta nuevamente.') } finally { setLoading(false) }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!open ? (
        <button onClick={()=> setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700">
          <span className="material-icons-outlined text-[18px]">support_agent</span>
          Ayuda
        </button>
      ) : (
        <div className="w-80 rounded-2xl border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><span className="material-icons-outlined text-[18px]">support_agent</span> Soporte</div>
            <button onClick={()=> setOpen(false)} className="rounded-lg border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">Cerrar</button>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <button onClick={()=> send('¿Cómo cargar un producto y agregar fotos?')} className="rounded-lg border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">Cargar producto</button>
              <button onClick={()=> send('¿Qué información poner en la descripción de mi producto?')} className="rounded-lg border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">Descripción</button>
              <button onClick={()=> send('¿Cómo gestionar un pedido en AgroLink?')} className="rounded-lg border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">Pedidos</button>
            </div>
            {loading && <p className="text-xs text-gray-600">Cargando…</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {messages.map((m,i)=> (
                <div key={i} className={`rounded-xl border px-2 py-1 text-xs ${m.role==='assistant' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>{m.content}</div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input value={input} onChange={(e)=> setInput(e.target.value)} placeholder="Escribe tu duda…" className="flex-1 rounded-lg border px-2 py-1 text-xs" />
              <button onClick={()=> send()} className="rounded-lg bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700">Enviar</button>
              <button onClick={toggleSpeak} disabled={!canSpeak || messages.length===0} className="rounded-lg border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                <span className="material-icons-outlined text-[18px]">{speaking ? 'volume_up' : 'volume_mute'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}