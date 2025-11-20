import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/apiClient'

export default function AssistantGuide({ autoOpen }: { autoOpen?: boolean }){
  const { user } = useAuth()
  const [open, setOpen] = useState(!!autoOpen)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<{ role: 'assistant' | 'user'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!open || messages.length) return
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const res = await apiFetch('/api/v1/ai/assist/guide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userName: user?.full_name || user?.email || '' }),
        })
        const data = await res.json()
        const text = data.output_text || 'Hola, te guío para iniciar en AgroLink.'
        setMessages([{ role: 'assistant', content: text }])
      } catch (e: any) {
        setError(e?.message || 'No se pudo cargar la guía')
      } finally { setLoading(false) }
    })()
  }, [open, user, messages.length])

  useEffect(() => {
    try {
      const first = typeof window !== 'undefined' ? localStorage.getItem('agrolink_first_login') : null
      if (first === '1') {
        setOpen(true)
        localStorage.removeItem('agrolink_first_login')
      }
    } catch {}
  }, [])

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

  function toggleSpeak(){
    if (!canSpeak || !utter) return
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false) }
    else { setSpeaking(true); window.speechSynthesis.speak(utter) }
  }

  async function send(){
    const q = input.trim()
    if (!q) return
    setMessages(m => [...m, { role: 'user', content: q }])
    setInput(''); setLoading(true); setError(null)
    try {
      const res = await apiFetch('/api/v1/ai/assist/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: user?.full_name || user?.email || '', question: q }),
      })
      const data = await res.json()
      const text = data.output_text || 'No tengo respuesta en este momento.'
      setMessages(m => [...m, { role: 'assistant', content: text }])
    } catch (e: any) {
      setError(e?.message || 'Fallo la verificación o la respuesta. Intenta nuevamente.')
    } finally { setLoading(false) }
  }

  return (
    <section className="mt-6 rounded-2xl border bg-white">
      <header className="flex items-center justify-between border-b p-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800"><span className="material-icons-outlined">assistant</span> Guía de inicio en AgroLink</h2>
        <button onClick={()=> setOpen(o=>!o)} className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">{open ? 'Cerrar' : 'Abrir'}</button>
      </header>
      {open && (
        <div className="p-3">
          <div className="mb-3 flex items-center gap-2">
            <button onClick={toggleSpeak} disabled={!canSpeak || messages.length===0} className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              <span className="material-icons-outlined text-[18px]">{speaking ? 'volume_up' : 'volume_mute'}</span>
              {speaking ? 'Leyendo' : 'Escuchar'}</button>
          </div>
          {loading && <p className="text-sm text-gray-600">Cargando…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-3">
            {messages.map((m,i)=> (
              <div key={i} className={`rounded-xl border px-3 py-2 text-sm ${m.role==='assistant' ? 'bg-green-50 border-green-200 text-gray-900' : 'bg-white border-gray-200 text-gray-900'}`}> {m.content} </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input value={input} onChange={(e)=> setInput(e.target.value)} placeholder="Escribe tu pregunta…" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
            <button onClick={send} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">Enviar</button>
          </div>
        </div>
      )}
    </section>
  )
}
