import type { Product } from '../types/product'
import { v4 as uuidv4 } from './uuid'

// Backend-only implementation: all persistence via REST to /api/* controllers.

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

async function uploadSingleImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${uuidv4()}.${ext}`
  const form = new FormData()
  form.append('bucket', 'product-images')
  form.append('path', path)
  form.append('file', file)
  const res = await fetch('/api/storage/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Error subiendo imagen (${res.status})`)
  // backend returns JSON or plain string; assume path only -> construct public URL via /api/storage/public-url
  const publicUrlRes = await fetch(`/api/storage/public-url?bucket=product-images&path=${encodeURIComponent(path)}`)
  const url = await publicUrlRes.text()
  return url
}

export async function uploadImages(userId: string, files: File[]): Promise<string[]> {
  const out: string[] = []
  for (const f of files) {
    out.push(await uploadSingleImage(userId, f))
  }
  return out
}

export async function createProduct(input: CreateInput): Promise<Product> {
  const image_urls = input.images.length ? await uploadImages(input.userId, input.images) : []
  const payload = {
    user_id: input.userId,
    name: input.name,
    description: input.description,
    price: input.price,
    quantity: input.quantity,
    category: input.category,
    image_urls,
    status: 'activo',
    location: input.location,
    lat: input.lat,
    lng: input.lng,
    created_at: new Date().toISOString()
  }
  const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(`Error creando producto (${res.status})`)
  const data = await res.json()
  return Array.isArray(data) ? (data[0] as Product) : (data as Product)
}

export async function listMyProducts(userId: string): Promise<Product[]> {
  const query = `select=*&user_id=eq.${userId}&order=created_at.desc`
  const res = await fetch(`/api/products?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Error listando productos')
  return await res.json() as Product[]
}

export async function getProductById(id: string): Promise<Product | null> {
  const query = `select=*&id=eq.${id}&limit=1`
  const res = await fetch(`/api/products?q=${encodeURIComponent(query)}`)
  if (!res.ok) return null
  const arr = await res.json() as Product[]
  return arr[0] || null
}

export async function updateProduct(id: string, patch: Partial<Omit<Product, 'id' | 'user_id' | 'created_at'>>): Promise<Product> {
  const res = await fetch(`/api/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
  if (!res.ok) throw new Error('Error actualizando producto')
  const data = await res.json()
  return Array.isArray(data) ? (data[0] as Product) : (data as Product)
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error eliminando producto')
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
  const { q, category, locationText, distanceKm, userLat, userLng, sort = 'relevance', limit = 60 } = filters
  // Construir parámetros de consulta (búsqueda OR para términos).
  const parts: string[] = ['select=*', 'status=eq.activo', `limit=${limit}`]
  if (category) parts.push(`category=eq.${encodeURIComponent(category)}`)
  const orSegments: string[] = []
  if (q && q.trim()) {
    const like = `%${q.trim()}%`
    orSegments.push(`name.ilike.${like}`, `description.ilike.${like}`)
  }
  if (locationText && locationText.trim()) {
    const likeLoc = `%${locationText.trim()}%`
    orSegments.push(`location.ilike.${likeLoc}`)
  }
  if (orSegments.length) parts.push(`or=${orSegments.join(',')}`)
  // order by created_at desc for relevance default
  parts.push('order=created_at.desc')
  const query = parts.join('&')
  const res = await fetch(`/api/products?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Error listando productos públicos')
  let items = await res.json() as Product[]
  // Client-side distance filter & sorting enhancements
  if (distanceKm && userLat!=null && userLng!=null) {
    items = items.filter(p => (p.lat!=null && p.lng!=null) && haversineKm(userLat, userLng, p.lat!, p.lng!) <= distanceKm)
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
    // relevance fallback: recent first
    arr.sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
  return arr
}

// Modo local y dependencias directas eliminadas: todo pasa por el backend.
