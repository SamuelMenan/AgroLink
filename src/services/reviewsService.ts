import { apiFetch } from './apiClient'
// Backend-only reviews service using /api/reviews facade

export type Review = {
  id: string
  productId: string
  userId: string
  rating: number
  comment: string
  createdAt: string
}

export type RatingSummary = { avg: number | null; count: number }

export async function createReview(input: { productId: string; userId: string; rating: number; comment: string }): Promise<Review> {
  const res = await apiFetch('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: input.productId, userId: input.userId, rating: input.rating, comment: input.comment })
  })
  if (!res.ok) throw new Error('Error creando reseña')
  return await res.json() as Review
}

export async function listReviewsByProduct(productId: string): Promise<Review[]> {
  const res = await apiFetch(`/api/reviews/product/${productId}`)
  if (!res.ok) throw new Error('Error listando reseñas')
  return await res.json() as Review[]
}

export async function getRatingSummary(productId: string): Promise<RatingSummary> {
  // Aggregate client-side from list (could be endpoint in backend later)
  try {
    const list = await listReviewsByProduct(productId)
    const count = list.length
    if (!count) return { avg: null, count: 0 }
    const sum = list.reduce((acc, r) => acc + r.rating, 0)
    return { avg: Math.round((sum / count) * 100) / 100, count }
  } catch {
    return { avg: null, count: 0 }
  }
}

