export type ProductStatus = 'activo' | 'inactivo'

export type Product = {
  id: string
  user_id: string
  name: string
  description: string
  price: number
  quantity: number
  category: string
  image_urls: string[]
  // Ubicación opcional
  location?: string
  lat?: number
  lng?: number
  status: ProductStatus
  created_at: string
  updated_at?: string
  // New fields
  price_per_unit?: number
  price_per_kilo?: number
  department?: string
  municipality?: string
  detailed_description?: string
  condition?: 'new' | 'used' | 'seasonal'
  stock_available?: boolean
}

export const PRODUCT_CATEGORIES = [
  'frutas',
  'verduras',
  'granos',
  'lácteos',
  'tubérculos',
  'hierbas',
  'otros',
] as const

export type ProductCategory = typeof PRODUCT_CATEGORIES[number]
