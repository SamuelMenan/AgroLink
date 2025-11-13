import { useState } from 'react'
import { Link } from 'react-router-dom'
import ProductForm, { type ProductFormValues } from '../../components/ProductForm'
import { useAuth } from '../../context/AuthContext'
import { createProduct } from '../../services/productService'

export default function PublishProduct() {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [publishedId, setPublishedId] = useState<string | null>(null)

  async function onSubmit(values: ProductFormValues) {
    setError(null)
    try {
      if (!user) { setError('Debes iniciar sesión.'); return }
      const created = await createProduct({
        userId: user.id,
        name: values.name.trim(),
        description: values.description.trim(),
        price: Number(values.price),
        quantity: Number(values.quantity),
        category: values.category,
        images: values.images,
        location: values.location?.trim() || undefined,
        lat: values.lat,
        lng: values.lng,
      })
      setPublishedId(created.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error publicando el producto'
      setError(msg)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {publishedId ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-green-800 shadow">
          <h2 className="text-xl font-semibold">¡Tu producto se publicó con éxito!</h2>
          <p className="mt-1 text-sm text-green-900/80">Ahora puedes gestionarlo desde tu panel.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/dashboard/products" className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-green-700">
              Ver mis publicaciones
            </Link>
            <Link to="/dashboard" className="inline-flex items-center justify-center rounded-lg border border-green-700/30 bg-white px-4 py-2.5 text-sm font-semibold text-green-800 shadow-sm hover:bg-green-50">
              Ir al panel
            </Link>
          </div>
          <div className="mt-6 border-t border-green-200 pt-4">
            <button onClick={()=>setPublishedId(null)} className="text-sm font-medium text-green-700 hover:text-green-800 hover:underline">
              Publicar otro producto
            </button>
          </div>
        </div>
      ) : (
        <>
          <ProductForm title="Publicar producto" onSubmit={onSubmit} submitLabel="Publicar" />
          <p className="mt-4 text-sm text-gray-600">Nota: asegúrate de que el backend tenga configurado almacenamiento de imágenes; de lo contrario las URLs no serán persistentes.</p>
        </>
      )}
    </main>
  )
}
