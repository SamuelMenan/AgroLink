import { isSupabaseEnabled, supabase } from './supabaseClient'
import type { Product } from '../types/product'
import { v4 as uuidv4 } from './uuid'

const STORAGE_BUCKET = 'product-images'
const TABLE = 'products'
const LS_KEY = 'agrolink_products'

type CreateInput = {
  userId: string
  name: string
  description: string
  price: number
  quantity: number
  category: string
  images: File[]
  location?: string
  lat?: number
  lng?: number
}

export async function uploadImages(userId: string, files: File[]): Promise<string[]> {
  if (!files.length) return []
  if (!isSupabaseEnabled()) {
    // Dev fallback: use object URLs (not persistent across reloads)
    return files.map((f) => URL.createObjectURL(f))
  }
  const urls: string[] = []
  for (const file of files) {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${userId}/${uuidv4()}.${ext}`
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false })
    if (error) throw new Error(`Error subiendo imagen: ${error.message}`)
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    if (!data?.publicUrl) throw new Error('No se pudo obtener URL pública de la imagen')
    urls.push(data.publicUrl)
  }
  return urls
}

export async function createProduct(input: CreateInput): Promise<Product> {
  const now = new Date().toISOString()
  const base: Omit<Product, 'id'> = {
    user_id: input.userId,
    name: input.name,
    description: input.description,
    price: input.price,
    quantity: input.quantity,
    category: input.category,
    image_urls: [],
    status: 'activo',
    created_at: now,
    location: input.location,
    lat: input.lat,
    lng: input.lng,
  }

  const image_urls = await uploadImages(input.userId, input.images)

  if (!isSupabaseEnabled()) {
    const p: Product = { id: uuidv4(), ...base, image_urls }
    const list = getLocal()
    list.push(p)
    setLocal(list)
    return p
  }

  const { data, error } = await supabase.from(TABLE).insert({
    user_id: base.user_id,
    name: base.name,
    description: base.description,
    price: base.price,
    quantity: base.quantity,
    category: base.category,
    image_urls,
    status: base.status,
    created_at: base.created_at,
    location: base.location,
    lat: base.lat,
    lng: base.lng,
  }).select('*').single()
  if (error) throw new Error(error.message)
  return data as Product
}

export async function listMyProducts(userId: string): Promise<Product[]> {
  if (!isSupabaseEnabled()) {
    return getLocal().filter(p => p.user_id === userId)
  }
  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Product[]
}

export async function getProductById(id: string): Promise<Product | null> {
  if (!isSupabaseEnabled()) {
    return getLocal().find(p => p.id === id) || null
  }
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single()
  if (error) return null
  return data as Product
}

export async function updateProduct(id: string, patch: Partial<Omit<Product, 'id' | 'user_id' | 'created_at'>>): Promise<Product> {
  if (!isSupabaseEnabled()) {
    const list = getLocal()
    const idx = list.findIndex(p => p.id === id)
    if (idx === -1) throw new Error('Producto no encontrado')
    const updated: Product = { ...list[idx], ...patch, updated_at: new Date().toISOString() }
    list[idx] = updated
    setLocal(list)
    return updated
  }
  const { data, error } = await supabase.from(TABLE).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  return data as Product
}

export async function deleteProduct(id: string): Promise<void> {
  if (!isSupabaseEnabled()) {
    const list = getLocal().filter(p => p.id !== id)
    setLocal(list)
    return
  }
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------- Búsqueda pública (HU04) ----------
export type SearchFilters = {
  q?: string
  category?: string
  locationText?: string
  distanceKm?: number
  userLat?: number
  userLng?: number
  sort?: 'relevance' | 'price-asc' | 'price-desc' | 'distance'
  limit?: number
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

export async function listPublicProducts(filters: SearchFilters = {}): Promise<Product[]> {
  const {
    q, category, locationText, distanceKm, userLat, userLng, sort = 'relevance', limit = 60,
  } = filters

  if (!isSupabaseEnabled()) {
    // Local fallback: filtrar en memoria
    let items = getLocal().filter(p => p.status === 'activo')
    if (q && q.trim()) {
      const t = q.toLowerCase()
      items = items.filter(p =>
        p.name.toLowerCase().includes(t) || p.description.toLowerCase().includes(t))
    }
    if (category) items = items.filter(p => p.category === category)
    if (locationText && locationText.trim()) {
      const lt = locationText.toLowerCase()
      items = items.filter(p => (p.location || '').toLowerCase().includes(lt))
    }
    // Filtrado por distancia si hay coords del usuario y del producto
    if (distanceKm && userLat != null && userLng != null) {
      items = items.filter(p => (p.lat != null && p.lng != null) && haversineKm(userLat, userLng, p.lat!, p.lng!) <= distanceKm)
    }
    // Orden
    items = sortItems(items, sort, userLat, userLng)
    return items.slice(0, limit)
  }

  // Supabase query: filtrar por status, categoría, textos; distancia se calcula en cliente
  let query = supabase.from(TABLE).select('*').eq('status', 'activo').limit(limit)
  if (category) query = query.eq('category', category)
  const ors: string[] = []
  if (q && q.trim()) {
    const like = `%${q.trim()}%`
    ors.push(`name.ilike.${like},description.ilike.${like}`)
  }
  if (locationText && locationText.trim()) {
    const likeLoc = `%${locationText.trim()}%`
    ors.push(`location.ilike.${likeLoc}`)
  }
  if (ors.length) {
    query = query.or(ors.join(','))
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  let items = (data as Product[]) || []
  if (distanceKm && userLat != null && userLng != null) {
    items = items.filter(p => (p.lat != null && p.lng != null) && haversineKm(userLat, userLng, p.lat!, p.lng!) <= distanceKm)
  }
  items = sortItems(items, sort, userLat, userLng)
  return items
}

function sortItems(items: Product[], sort: SearchFilters['sort'], userLat?: number, userLng?: number): Product[] {
  const arr = [...items]
  if (sort === 'price-asc') arr.sort((a,b)=>a.price-b.price)
  else if (sort === 'price-desc') arr.sort((a,b)=>b.price-a.price)
  else if (sort === 'distance' && userLat!=null && userLng!=null) {
    arr.sort((a,b)=>{
      const da = (a.lat!=null && a.lng!=null) ? haversineKm(userLat, userLng, a.lat!, a.lng!) : Number.POSITIVE_INFINITY
      const db = (b.lat!=null && b.lng!=null) ? haversineKm(userLat, userLng, b.lat!, b.lng!) : Number.POSITIVE_INFINITY
      return da - db
    })
  } else {
    // relevance: simple heuristic name match length then recent
    arr.sort((a,b)=>{
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }
  return arr
}

// Local storage helpers (mock mode)
function getLocal(): Product[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Product[]) : []
  } catch {
    return []
  }
}
function setLocal(list: Product[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list))
}
