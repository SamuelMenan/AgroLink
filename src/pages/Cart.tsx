import { useEffect, useMemo, useState } from 'react'
import { listCart, removeFromCart, clearCart, type CartItem } from '../services/cartService'
import { createConversation } from '../services/messagingService'

export default function Cart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [bulkMessage, setBulkMessage] = useState('')
  const [selectedSellers, setSelectedSellers] = useState<Record<string, boolean>>({})
  const [sending, setSending] = useState(false)

  useEffect(()=>{ setItems(listCart()) }, [])

  const total = useMemo(()=> items.reduce((acc, it)=> acc + it.price * 1, 0), [items])
  const sellers = useMemo(()=> {
    const map = new Map<string, { id: string; name: string }>()
    items.forEach(it => { if (it.seller_id) map.set(it.seller_id, { id: it.seller_id, name: '' }) })
    return Array.from(map.values())
  }, [items])

  function refresh(){ setItems(listCart()) }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-800">Carrito (modo mensajería)</h1>
        {items.length>0 && (
          <button onClick={()=>{ clearCart(); refresh() }} className="rounded-md border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Vaciar</button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="mt-6 rounded-md border bg-white p-6 text-gray-600">Tu carrito está vacío.</div>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {items.map((it)=> (
              <div key={it.id} className="flex items-center justify-between gap-3 rounded-md border border-green-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  {it.image_url ? <img src={it.image_url} alt={it.name} className="h-12 w-12 rounded object-cover"/> : <div className="h-12 w-12 rounded bg-gray-100"/>}
                  <div>
                    <p className="font-medium">{it.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                      <label title="Cantidad fija por mensaje">Cantidad:</label>
                      <span className="inline-block rounded border bg-gray-50 px-3 py-1 text-sm text-gray-700 select-none" aria-readonly>1</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold" title="Precio no editable">${(it.price).toLocaleString()}</p>
                  <button onClick={()=>{ removeFromCart(it.id); refresh() }} className="mt-1 text-xs text-red-600 hover:underline">Quitar</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-md border bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">Total estimado: ${total.toLocaleString()}</p>
              <span className="text-sm text-gray-600" title="Este carrito se usa para contactar a múltiples vendedores y coordinar compras fuera de la plataforma.">Modo: Mensajería a vendedores</span>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Mensaje para vendedores</label>
              <textarea value={bulkMessage} onChange={(e)=> setBulkMessage(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" rows={3} placeholder="Escribe tu mensaje (ej. consulta de disponibilidad, precio, entrega)"></textarea>
              <p className="mt-1 text-xs text-gray-600">Consejo: Indica cantidades aproximadas y condiciones de entrega. Este mensaje se enviará a los vendedores seleccionados.</p>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Vendedores seleccionados</label>
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {sellers.length === 0 ? (
                  <p className="text-sm text-gray-600">No hay vendedores asociados a estos productos.</p>
                ) : sellers.map(s => (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={selectedSellers[s.id] ?? true} onChange={(e)=> setSelectedSellers(prev => ({ ...prev, [s.id]: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-600" />
                    <span>{s.id}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button disabled={sending || !bulkMessage.trim() || sellers.length===0} onClick={async ()=>{
                setSending(true)
                try {
                  const targets = sellers.filter(s => selectedSellers[s.id] ?? true)
                  for (const it of items) {
                    if (it.seller_id && targets.some(t => t.id === it.seller_id)) {
                      await createConversation({ participantId: it.seller_id, productId: it.id, initialMessage: bulkMessage.trim() })
                    }
                  }
                  setBulkMessage('')
                } finally {
                  setSending(false)
                }
              }} className="rounded-md bg-green-600 px-4 py-2.5 text-white shadow hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60">
                {sending ? 'Enviando…' : 'Enviar mensaje a múltiples vendedores'}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
