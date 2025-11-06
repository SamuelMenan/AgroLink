import { isSupabaseEnabled, supabase } from './supabaseClient'
import { v4 as uuidv4 } from './uuid'

export type Review = {
  id: string
  product_id: string
  buyer_id: string
  order_id?: string | null
  rating: number
  comment?: string | null
  is_hidden: boolean
  flagged_reason?: string | null
  created_at: string
  updated_at: string
}

export type RatingSummary = { avg: number | null; count: number }

export async function createReview(input: { product_id: string; buyer_id: string; rating: number; comment?: string; order_id?: string | null }): Promise<Review> {
  const row = {
    product_id: input.product_id,
    buyer_id: input.buyer_id,
    order_id: input.order_id ?? null,
    rating: input.rating,
    comment: input.comment ?? null,
  }
  if (!isSupabaseEnabled()) {
    const id = uuidv4()
    const now = new Date().toISOString()
    const mock: Review = { id, ...row, is_hidden: false, created_at: now, updated_at: now }
    _reviews.push(mock)
    recalc(input.product_id)
    return mock
  }
  const { data, error } = await supabase.from('product_reviews').insert(row).select('*').single()
  if (error) throw new Error(error.message)
  return data as Review
}

export type ReviewsSort = 'date' | 'relevance'

export async function listReviewsByProduct(productId: string, sort: ReviewsSort = 'date'): Promise<Review[]> {
  if (!isSupabaseEnabled()) {
    let list = _reviews.filter(r => r.product_id === productId && !r.is_hidden)
    list = applySort(list, sort)
    return list
  }
  let q = supabase.from('product_reviews').select('*').eq('product_id', productId).eq('is_hidden', false)
  if (sort === 'date') q = q.order('created_at', { ascending: false })
  else q = q.order('rating', { ascending: false }).order('created_at', { ascending: false })
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data || []) as Review[]
}

export async function getRatingSummary(productId: string): Promise<RatingSummary> {
  if (!isSupabaseEnabled()) {
    const s = _summaries.get(productId) || { avg: null, count: 0 }
    return s
  }
  // Prefer product aggregate columns if available
  const { data: prod, error: errProd } = await supabase.from('products').select('avg_rating, ratings_count').eq('id', productId).maybeSingle()
  if (!errProd && prod) {
    return { avg: prod.avg_rating ?? null, count: prod.ratings_count ?? 0 }
  }
  // Fallback: compute from reviews
  const { data, error } = await supabase.from('product_reviews').select('rating').eq('product_id', productId).eq('is_hidden', false)
  if (error) throw new Error(error.message)
  const arr = (data || []) as { rating: number }[]
  if (!arr.length) return { avg: null, count: 0 }
  const sum = arr.reduce((a,b)=> a + b.rating, 0)
  return { avg: Math.round((sum/arr.length)*100)/100, count: arr.length }
}

function applySort(list: Review[], sort: ReviewsSort): Review[] {
  const arr = [...list]
  if (sort === 'date') return arr.sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  // relevance: higher rating first, then recent
  return arr.sort((a,b)=> (b.rating - a.rating) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
}

// ---- Mock storage ----
const _reviews: Review[] = []
const _summaries = new Map<string, RatingSummary>()
function recalc(productId: string){
  const arr = _reviews.filter(r=> r.product_id === productId && !r.is_hidden)
  const count = arr.length
  const avg = count ? Math.round((arr.reduce((a,b)=>a+b.rating,0)/count)*100)/100 : null
  _summaries.set(productId, { avg, count })
}
