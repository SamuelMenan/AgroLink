import { useEffect, useMemo, useState } from 'react'
import { listCart, removeFromCart, setItemQuantity, clearCart, type CartItem } from '../services/cartService'

export default function Cart() {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(()=>{ setItems(listCart()) }, [])

  const total = useMemo(()=> items.reduce((acc, it)=> acc + it.price * it.quantity, 0), [items])

  function refresh(){ setItems(listCart()) }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-800">Carrito</h1>
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
                      <label>Cantidad:</label>
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e)=>{ setItemQuantity(it.id, Math.max(1, Number(e.target.value)||1)); refresh() }}
                        className="w-16 rounded border px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${(it.price * it.quantity).toLocaleString()}</p>
                  <button onClick={()=>{ removeFromCart(it.id); refresh() }} className="mt-1 text-xs text-red-600 hover:underline">Quitar</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <p className="text-lg font-semibold">Total: ${total.toLocaleString()}</p>
            <button className="rounded-md bg-green-600 px-4 py-2.5 text-white shadow hover:bg-green-700">Proceder al pago</button>
          </div>
        </>
      )}
    </main>
  )
}
