import { useEffect, useMemo, useState } from 'react'
import { PRODUCT_CATEGORIES, type Product } from '../types/product'
import { addToCart } from '../services/cartService'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { listPublicProducts, type SearchFilters, deleteProduct as deleteLocalProduct } from '../services/productService'
import { contactUser } from '../services/messagingService'

export default function Products() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<string>('')
  const [locationText, setLocationText] = useState('')
  const [distanceKm, setDistanceKm] = useState<string>('')
  const [coords, setCoords] = useState<{lat:number,lng:number}|null>(null)
  const [sort, setSort] = useState<SearchFilters['sort']>('relevance')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Product[]>([])
  const [error, setError] = useState<string|null>(null)

  const filtersRaw = useMemo(() => ({ q, category, locationText, distanceKm, sort }), [q, category, locationText, distanceKm, sort])
  const debounced = useDebouncedValue(filtersRaw, 350)

  useEffect(()=>{
    ;(async ()=>{
      try {
        await fetch('/api/proxy/actuator/health', { cache: 'no-store' })
      } catch {}
    })()
  }, [])

  useEffect(()=>{
    let alive = true
    async function run(){
      setLoading(true); setError(null)
      try {
        const filters: SearchFilters = {
          q: debounced.q || undefined,
          category: debounced.category || undefined,
          locationText: debounced.locationText || undefined,
          distanceKm: debounced.distanceKm ? Number(debounced.distanceKm) : undefined,
          userLat: coords?.lat,
          userLng: coords?.lng,
          sort: debounced.sort,
          limit: 60,
        }
        const res = await listPublicProducts(filters)
        if (!alive) return
        setItems(res)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error cargando productos'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    run()
    return ()=>{ alive = false }
  }, [debounced, coords])

  function useMyLocation(){
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos)=>{
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    })
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-2xl font-bold text-green-800">Buscar productos</h1>

      {/* Filtros */}
      <section className="mt-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar por nombre o descripción" className="rounded-lg border border-gray-300/90 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
          <select value={category} onChange={(e)=>setCategory(e.target.value)} className="rounded-lg border border-gray-300/90 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20">
            <option value="">Todas las categorías</option>
            {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={locationText} onChange={(e)=>setLocationText(e.target.value)} placeholder="Ubicación (ciudad/municipio)" className="rounded-lg border border-gray-300/90 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
          <div className="flex gap-2">
            <input value={distanceKm} onChange={(e)=>setDistanceKm(e.target.value)} inputMode="numeric" placeholder="Distancia (km)" className="w-full rounded-lg border border-gray-300/90 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
            <button type="button" onClick={useMyLocation} className="shrink-0 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Mi ubicación</button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-gray-600">{coords ? 'Ubicación establecida' : 'Puedes usar tu ubicación para filtrar por distancia'}</p>
          <select value={sort} onChange={(e)=>setSort(e.target.value as SearchFilters['sort'])} className="rounded-lg border border-gray-300/90 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20">
            <option value="relevance">Ordenar por: relevancia</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
            <option value="distance">Distancia</option>
          </select>
        </div>
      </section>

      {/* Resultados */}
      <section className="mt-6">
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({length:6}).map((_,i)=> (
              <div key={i} className="h-56 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600">No se encontraron coincidencias.</div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(p => <ProductCard key={p.id} p={p} userLat={coords?.lat} userLng={coords?.lng} />)}
          </div>
        )}
      </section>
    </main>
  )
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(()=>{
    const t = setTimeout(()=> setDebounced(value), delay)
    return ()=> clearTimeout(t)
  }, [value, delay])
  return debounced
}

function ProductCard({ p, userLat, userLng }: { p: Product, userLat?: number, userLng?: number }){
  const { user } = useAuth()
  const navigate = useNavigate()
  const [msgText, setMsgText] = useState('Hola. ¿Sigue estando disponible?')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [msgSent, setMsgSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const [removed, setRemoved] = useState(false)
  const firstImage = p.image_urls?.[0]
  const isOwner = user?.id === p.user_id
  const distanceKm = useMemo(()=>{
    if (userLat==null || userLng==null || p.lat==null || p.lng==null) return null
    return haversineKm(userLat, userLng, p.lat, p.lng)
  }, [userLat, userLng, p.lat, p.lng])
  const [rating, setRating] = useState<{avg:number|null,count:number}>({ avg: null, count: 0 })
  useEffect(()=>{
    let alive = true
    ;(async ()=>{
      try {
        // Ratings obtención vía backend futuro; por ahora placeholder
        if (!alive) return
        setRating({ avg: null, count: 0 })
      } catch {
        // ignore silently
      }
    })()
    return ()=>{ alive = false }
  }, [p.id])
  if (removed) return null
  async function sendMarketplaceMessage(){
    setErr(null)
    if (!user) {
      navigate(`/login?intent=message&next=/products`)
      return
    }
    if (isOwner) {
      setErr('Este es tu producto.')
      return
    }
    const text = msgText.trim()
    if (!text) {
      setErr('Escribe un mensaje.')
      return
    }
    setSendingMsg(true)
    try {
      try { await fetch('/api/proxy/actuator/health', { cache: 'no-store' }) } catch {}
      // Crear/asegurar conversación con el vendedor y enviar mensaje inicial
      await contactUser(user.id, p.user_id, text)
      setMsgSent(true)
    } catch (e) {
      let m = e instanceof Error ? e.message : 'No fue posible enviar el mensaje'
      const is5xx = /\b5\d{2}\b/.test(m) || /Error\s+5\d\d/.test(m)
      if (is5xx) m = 'Estamos iniciando el servidor, intenta de nuevo en unos segundos'
      setErr(m)
    } finally {
      setSendingMsg(false)
    }
  }
  function onAddToCart(){
    addToCart({ id: p.id, name: p.name, price: p.price, image_url: p.image_urls?.[0], seller_id: p.user_id }, 1)
    setAdded(true)
    setTimeout(()=> setAdded(false), 1200)
  }
  return (
    <div className="overflow-hidden rounded-xl border border-green-100 bg-white p-4 shadow-sm">
      {firstImage ? (
        <img src={firstImage} alt={p.name} className="h-40 w-full rounded-md object-cover" />
      ) : (
        <div className="h-40 w-full rounded-md bg-gradient-to-br from-green-50 to-gray-100" />
      )}
      <h3 className="mt-3 text-lg font-semibold">{p.name}</h3>
      <p className="line-clamp-2 text-sm text-gray-600">{p.description}</p>
      <div className="mt-2 flex items-center justify-between text-sm text-gray-700">
        <span className="font-semibold text-green-700">${p.price.toLocaleString()}</span>
        <span>{p.quantity} u.</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
        {rating.avg!=null ? (
          <span title={`${rating.avg} de 5 (${rating.count})`} className="inline-flex items-center gap-1">
            <span className="text-amber-500">{'★'.repeat(Math.round(rating.avg))}{'☆'.repeat(5-Math.round(rating.avg))}</span>
            <span>{rating.avg.toFixed(1)} ({rating.count})</span>
          </span>
        ) : (
          <span className="text-gray-400">Sin calificaciones</span>
        )}
        <span />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
        <span>{p.location || 'Sin ubicación'}</span>
        {distanceKm!=null && Number.isFinite(distanceKm) && (
          <span>{distanceKm.toFixed(1)} km</span>
        )}
      </div>
      {isOwner ? (
        <div className="mt-3 rounded-xl border border-green-200 bg-white p-3">
          <p className="text-sm text-gray-600">Este es tu producto.</p>
          <div className="mt-3 flex gap-2">
            <Link to={`/dashboard/products/${p.id}/edit`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-600 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50">
              <span className="material-icons-outlined text-[18px]">edit</span>
              Editar
            </Link>
            <button
              type="button"
              onClick={async ()=>{
                const ok = window.confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')
                if (!ok) return
                try {
                  await deleteLocalProduct(p.id)
                  setRemoved(true)
                } catch (e) {
                  const m = e instanceof Error ? e.message : 'No se pudo eliminar'
                  setErr(m)
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-600 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              <span className="material-icons-outlined text-[18px]">delete</span>
              Eliminar
            </button>
          </div>
          {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        </div>
      ) : (
        <>
          {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
          <div className="mt-3 rounded-xl border border-green-200 bg-white">
            <div className="border-b border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-900">Envía un mensaje al vendedor</div>
            <div className="p-3">
              <textarea
                value={msgText}
                onChange={(e)=> setMsgText(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                placeholder="Hola. ¿Sigue estando disponible?"
              />
              {msgSent ? (
                <a
                  href={`/messages?with=${encodeURIComponent(p.user_id)}`}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  <span className="material-icons-outlined text-[18px]">chat</span>
                  Abrir chat
                </a>
              ) : (
                <button
                  onClick={sendMarketplaceMessage}
                  disabled={sendingMsg}
                  className="mt-3 w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingMsg ? 'Enviando…' : 'Enviar'}
                </button>
              )}
            </div>
          </div>
          <button onClick={onAddToCart} className="mt-2 w-full rounded-md border border-amber-600 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-600 hover:text-white">
            {added ? 'Agregado ✓' : 'Agregar al carrito'}
          </button>
        </>
      )}
    </div>
  )
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
