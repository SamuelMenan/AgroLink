import { useEffect, useMemo, useState } from 'react'
import { type Product } from '../types/product'
import { addToCart } from '../services/cartService'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { listPublicProducts, type SearchFilters, deleteProduct as deleteLocalProduct } from '../services/productService'

import { EnhancedSearch, type EnhancedSearchFilters } from '../components/EnhancedSearch'

export default function Products() {
  const [enhancedFilters, setEnhancedFilters] = useState<EnhancedSearchFilters>({
    q: '',
    category: '',
    locationText: '',
    distanceKm: '',
    minPrice: '',
    maxPrice: '',
    certifications: [],
    season: '',
    sort: 'relevance'
  })
  const [coords] = useState<{lat:number,lng:number}|null>(null)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Product[]>([])
  const [error, setError] = useState<string|null>(null)
  const [offlineStatus] = useState<{isOffline: boolean, queueSize: number}>({ isOffline: false, queueSize: 0 })

  const filtersRaw = useMemo(() => ({ 
    q: enhancedFilters.q, 
    category: enhancedFilters.category, 
    locationText: enhancedFilters.locationText, 
    distanceKm: enhancedFilters.distanceKm, 
    sort: enhancedFilters.sort 
  }), [enhancedFilters])
  const debounced = useDebouncedValue(filtersRaw, 200)

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
          // Add enhanced filters support when backend is ready
          // TODO: Implement backend support for enhanced filters
          // minPrice: enhancedFilters.minPrice ? Number(enhancedFilters.minPrice) : undefined,
          // maxPrice: enhancedFilters.maxPrice ? Number(enhancedFilters.maxPrice) : undefined,
          // certifications: enhancedFilters.certifications.length > 0 ? enhancedFilters.certifications : undefined,
          // season: enhancedFilters.season || undefined
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

  const handleFiltersChange = (newFilters: EnhancedSearchFilters) => {
    setEnhancedFilters(newFilters)
  }

  const handleSearch = (filters: EnhancedSearchFilters) => {
    // Search is handled automatically through the debounced effect
    console.log('Search triggered with filters:', filters)
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-2xl font-bold text-green-800">Buscar productos</h1>

      {/* Enhanced Search Component */}
      <section className="mt-5">
        <EnhancedSearch
          filters={enhancedFilters}
          onFiltersChange={handleFiltersChange}
          onSearch={handleSearch}
          showAdvancedFilters={true}
        />
      </section>

      {/* Resultados */}
      <section className="mt-6">
        {offlineStatus.isOffline && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-[18px]">cloud_off</span>
              <span>Modo offline activado. {offlineStatus.queueSize} mensaje(s) guardados localmente.</span>
            </div>
          </div>
        )}
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
        {loading ? (
          <div className="space-y-8">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative h-20 w-20">
                <div className="absolute inset-0 rounded-full border-4 border-green-200"></div>
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-green-600 border-t-transparent"></div>
              </div>
              <p className="mt-6 text-base font-medium text-gray-700">Cargando productos...</p>
              <p className="mt-1 text-sm text-gray-500">Esto puede tardar unos segundos</p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({length:6}).map((_,i)=> (
                <div key={i} className="h-56 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
              ))}
            </div>
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

  const [err, setErr] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [messageSent, setMessageSent] = useState(false)
  const [message, setMessage] = useState('Hola. ¿Sigue estando disponible?')
  const firstImage = p.image_urls?.[0]
  const isOwner = user?.id === p.user_id
  const distanceKm = useMemo(()=>{
    if (userLat==null || userLng==null || p.lat==null || p.lng==null) return null
    return haversineKm(userLat, userLng, p.lat, p.lng)
  }, [userLat, userLng, p.lat, p.lng])
  const [rating, setRating] = useState<{avg:number|null,count:number}>({ avg: null, count: 0 })
  
  // Enhanced features for agricultural products
  const getConditionLabel = (condition?: string) => {
    switch(condition) {
      case 'fresh': return 'Fresco'
      case 'organic': return 'Orgánico'
      case 'conventional': return 'Convencional'
      default: return null
    }
  }
  
  const getConditionColor = (condition?: string) => {
    switch(condition) {
      case 'fresh': return 'bg-green-100 text-green-800'
      case 'organic': return 'bg-emerald-100 text-emerald-800'
      case 'conventional': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }
  
  const formatAgriculturalQuantity = (quantity: string) => {
    // Format quantity with proper agricultural units
    if (quantity.includes('arroba')) {
      const value = quantity.replace('arroba', '').trim()
      return `${value} @ (${parseFloat(value) * 12.5} kg)`
    }
    if (quantity.includes('fanega')) {
      const value = quantity.replace('fanega', '').trim()
      return `${value} fan (${parseFloat(value) * 6400} m²)`
    }
    return quantity
  }
  
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
  
  function onAddToCart(){
    addToCart({ id: p.id, name: p.name, price: p.price, image_url: p.image_urls?.[0], seller_id: p.user_id }, 1)
    setAdded(true)
    setTimeout(()=> setAdded(false), 1200)
  }

  async function handleSendMessage() {
    if (!message.trim() || isSending) return
    
    setIsSending(true)
    console.log(`Sending message to seller ${p.user_id}: ${message}`)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setMessageSent(true)
      setTimeout(() => {
        setMessageSent(false)
        setIsMessageModalOpen(false)
        setMessage('Hola. ¿Sigue estando disponible?')
      }, 2000)
    } catch {
      setErr('Error al enviar el mensaje')
    } finally {
      setIsSending(false)
    }
  }
  return (
    <div className="overflow-hidden rounded-xl border border-green-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Enhanced Image Section with Condition Badge */}
      <div className="relative">
        {firstImage ? (
          <img src={firstImage} alt={p.name} className="h-40 w-full rounded-md object-cover" />
        ) : (
          <div className="h-40 w-full rounded-md bg-gradient-to-br from-green-50 to-gray-100 flex items-center justify-center">
            <span className="material-icons-outlined text-4xl text-green-300">agriculture</span>
          </div>
        )}
        {p.condition && (
          <span className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${getConditionColor(p.condition)}`}>
            {getConditionLabel(p.condition)}
          </span>
        )}
        {p.stock_available === false && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-md flex items-center justify-center">
            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">Agotado</span>
          </div>
        )}
      </div>
      
      {/* Enhanced Product Information */}
      <h3 className="mt-3 text-lg font-semibold text-gray-900">{p.name}</h3>
      
      {/* Category and Location */}
      <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full capitalize">{p.category}</span>
        {(p.department || p.municipality) && (
          <span className="flex items-center gap-1">
            <span className="material-icons-outlined text-[14px]">location_on</span>
            {p.municipality ? `${p.municipality}, ${p.department}` : p.department}
          </span>
        )}
      </div>
      
      {/* Enhanced Description */}
      <p className="mt-2 line-clamp-2 text-sm text-gray-600">
        {p.detailed_description || p.description}
      </p>
      
      {/* Enhanced Pricing Section */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-green-700 text-lg">${p.price.toLocaleString()}</span>
          <span className="text-sm text-gray-600">{formatAgriculturalQuantity(p.quantity)}</span>
        </div>
        
        {/* Additional Pricing Information */}
        {(p.price_per_unit || p.price_per_kilo) && (
          <div className="text-xs text-gray-500 space-y-1">
            {p.price_per_unit && (
              <div className="flex justify-between">
                <span>Precio por unidad:</span>
                <span className="font-medium">${p.price_per_unit.toLocaleString()}</span>
              </div>
            )}
            {p.price_per_kilo && (
              <div className="flex justify-between">
                <span>Precio por kilo:</span>
                <span className="font-medium">${p.price_per_kilo.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Enhanced Rating and Distance */}
      <div className="mt-2 flex items-center justify-between text-xs">
        {rating.avg!=null ? (
          <span title={`${rating.avg} de 5 (${rating.count})`} className="inline-flex items-center gap-1">
            <span className="text-amber-500">{'★'.repeat(Math.round(rating.avg))}{'☆'.repeat(5-Math.round(rating.avg))}</span>
            <span className="text-gray-700">{rating.avg.toFixed(1)} ({rating.count})</span>
          </span>
        ) : (
          <span className="text-gray-400 flex items-center gap-1">
            <span className="material-icons-outlined text-[14px]">star_outline</span>
            Sin calificaciones
          </span>
        )}
        {distanceKm!=null && Number.isFinite(distanceKm) && (
          <span className="flex items-center gap-1 text-gray-600">
            <span className="material-icons-outlined text-[14px]">directions_car</span>
            {distanceKm.toFixed(1)} km
          </span>
        )}
      </div>
      {isOwner ? (
        <div className="mt-4 rounded-xl border border-green-200 bg-white p-3">
          <p className="text-sm text-gray-600 mb-3">Este es tu producto.</p>
          <div className="flex gap-2">
            <Link 
              to={`/dashboard/products/${p.id}/edit`} 
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-600 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors"
              aria-label={`Editar ${p.name}`}
            >
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
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-600 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
              aria-label={`Eliminar ${p.name}`}
            >
              <span className="material-icons-outlined text-[18px]">delete</span>
              Eliminar
            </button>
          </div>
          {err && <p className="mt-2 text-xs text-red-600" role="alert">{err}</p>}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {err && <p className="text-xs text-red-600" role="alert">{err}</p>}
          
          {/* Inline Message Form or Button */}
          {isMessageModalOpen ? (
            <div className="bg-gray-50 rounded-lg p-3 space-y-3 border border-gray-200">
              {messageSent ? (
                <div className="text-center py-4">
                  <span className="inline-flex items-center gap-2 text-green-600 font-medium">
                    <span className="material-icons-outlined text-xl">check_circle</span>
                    Mensaje enviado
                  </span>
                </div>
              ) : (
                <>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                    rows={3}
                    disabled={isSending}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSendMessage}
                      disabled={isSending || !message.trim()}
                      className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                        isSending || !message.trim()
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {isSending ? 'Enviando...' : 'Enviar'}
                    </button>
                    <button
                      onClick={() => {
                        setIsMessageModalOpen(false)
                        setMessage('Hola. ¿Sigue estando disponible?')
                      }}
                      disabled={isSending}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button 
              onClick={() => setIsMessageModalOpen(true)} 
              disabled={p.stock_available === false}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                p.stock_available === false
                  ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'border-blue-500 text-blue-600 hover:bg-blue-50'
              }`}
              aria-label={`Enviar mensaje al vendedor de ${p.name}`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.905 1.463 5.499 3.75 7.189V22l3.427-1.88c.915.253 1.856.38 2.823.38 5.523 0 10-4.145 10-9.257S17.523 2 12 2zm.995 12.468l-2.567-2.736-5.01 2.736 5.51-5.844 2.628 2.736 4.949-2.736-5.51 5.844z"/>
              </svg>
              Enviar mensaje al vendedor
            </button>
          )}
          
          {/* Enhanced Add to Cart Button */}
          <button 
            onClick={onAddToCart} 
            disabled={p.stock_available === false}
            className={`w-full rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
              added 
                ? 'border-green-600 bg-green-600 text-white' 
                : p.stock_available === false
                ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'border-amber-600 text-amber-700 hover:bg-amber-600 hover:text-white'
            }`}
            aria-label={added ? 'Producto agregado' : `Agregar ${p.name} al carrito`}
          >
            {added ? 'Agregado ✓' : p.stock_available === false ? 'Producto agotado' : 'Agregar al carrito'}
          </button>
        </div>
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
