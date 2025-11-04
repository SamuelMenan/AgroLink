import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseEnabled } from '../services/supabaseClient'

export default function RealtimeNotifications(){
  const { user } = useAuth()
  const [msg, setMsg] = useState<string|null>(null)

  useEffect(()=>{
    if (!user || !isSupabaseEnabled()) return
    const channel = supabase.channel('requests-notify')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests', filter: `buyer_id=eq.${user.id}` }, (payload) => {
        const newRow = (payload as { new?: { status?: string } }).new
        if (newRow?.status === 'aceptada') setMsg('Tu solicitud fue aceptada 🎉')
        else if (newRow?.status === 'rechazada') setMsg('Tu solicitud fue rechazada')
      })
      .subscribe()
    return ()=>{ supabase.removeChannel(channel) }
  }, [user])

  if (!msg) return null
  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-50 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-gray-800">{msg}</span>
        <button className="rounded bg-gray-100 px-2 py-0.5 text-xs" onClick={()=>setMsg(null)}>Cerrar</button>
      </div>
    </div>
  )
}
