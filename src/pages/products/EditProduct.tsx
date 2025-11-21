import { useEffect, useState } from 'react'
import ProductForm, { type ProductFormValues } from '../../components/ProductForm'
import { useParams, useNavigate } from 'react-router-dom'
import { getProductById, updateProduct, uploadImages } from '../../services/productService'
import type { Product } from '../../types/product'
import { useAuth } from '../../context/AuthContext'

export default function EditProduct() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!id) return
      const p = await getProductById(id)
      if (!p) { setError('Producto no encontrado'); return }
      if (mounted) setProduct(p)
    }
    load()
    return () => { mounted = false }
  }, [id])

  async function onSubmit(values: ProductFormValues) {
    if (!id || !user) return
    setError(null)
    try {
      let image_urls = values.existing_image_urls || product?.image_urls || []
      if (values.images && values.images.length > 0) {
        // append new uploads to existing
        const newUrls = await uploadImages(user.id, values.images)
        image_urls = [...image_urls, ...newUrls]
      }
      await updateProduct(id, {
        name: values.name.trim(),
        description: values.description.trim(),
        price: Number(values.price),
        quantity: values.quantity.trim(),
        category: values.category,
        image_urls,
        location: values.location?.trim() || undefined,
        lat: values.lat,
        lng: values.lng,
      })
      navigate('/dashboard/products')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error actualizando'
      setError(msg)
    }
  }

  if (!product) return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      {error ? <p className="text-sm text-red-600">{error}</p> : <p>Cargando…</p>}
    </main>
  )

  const initial: Partial<ProductFormValues> = {
    name: product.name,
    description: product.description,
    price: String(product.price),
    quantity: String(product.quantity),
    category: product.category,
    location: product.location,
    lat: product.lat,
    lng: product.lng,
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      <ProductForm title="Editar producto" initial={initial} existingImages={product.image_urls} onSubmit={onSubmit} submitLabel="Guardar cambios" />
    </main>
  )
}
