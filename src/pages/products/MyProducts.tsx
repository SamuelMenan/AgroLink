import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { listMyProducts, deleteProduct } from '../../services/productService'
import type { Product } from '../../types/product'
import { Link } from 'react-router-dom'

export default function MyProducts() {
  const { user } = useAuth()
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!user) return
      try {
        setLoading(true)
        const products = await listMyProducts(user.id)
        if (mounted) setItems(products)
      } catch {
        if (mounted) setError('Error cargando productos')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [user])

  async function onDelete(id: string) {
    if (!confirm('¿Eliminar este producto?')) return
    try {
      await deleteProduct(id)
      setItems(prev => prev.filter(p => p.id !== id))
    } catch (e) {
      console.error(e)
      alert('Error eliminando producto')
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-green-800">Mis productos</h1>
        <Link to="/dashboard/products/new" className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-green-700">Publicar nuevo</Link>
      </div>
      {loading && <p>Cargando…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && items.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">Aún no has publicado productos.</div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(p => (
          <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {p.image_urls?.[0] && (
              <img src={p.image_urls[0]} alt={p.name} className="mb-3 h-40 w-full rounded-lg object-cover" />
            )}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">{p.name}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === 'activo' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{p.status}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">{p.description}</p>
            <div className="mt-2 text-sm text-gray-800">COP {p.price.toLocaleString()} • {p.quantity} unid.</div>
            <div className="mt-1 text-xs text-gray-500">Creado: {new Date(p.created_at).toLocaleDateString()}</div>
            <div className="mt-4 flex items-center gap-2">
              <Link to={`/dashboard/products/${p.id}/edit`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50">Editar</Link>
              <button onClick={() => onDelete(p.id)} className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
