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
        setError(null)
        const products = await listMyProducts(user.id)
        if (mounted) setItems(products)
      } catch (e) {
        if (mounted) {
          const msg = e instanceof Error ? e.message : 'Error cargando productos'
          if (msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('unavailable')) {
            setError('El servidor está arrancando. Espera unos segundos y recarga la página.')
          } else if (msg.includes('storage') || msg.includes('bucket') || msg.includes('image')) {
            setError('Error al cargar imágenes de productos. Algunas imágenes pueden no estar disponibles.')
          } else if (msg.includes('timeout')) {
            setError('La carga de productos está tardando demasiado. Intenta recargar la página.')
          } else if (msg.includes('404')) {
            setError('No se encontraron productos.')
          } else if (msg.includes('unauthorized') || msg.includes('permission')) {
            setError('No tienes permisos para ver estos productos.')
          } else {
            setError(msg)
          }
        }
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
      console.error('Error eliminando producto:', e)
      const error = e as any
      
      // Handle specific storage bucket errors
      if (error.message?.includes('storage') || error.message?.includes('bucket')) {
        alert('Error al eliminar imágenes del producto. El producto puede tener imágenes almacenadas que no se pudieron eliminar.')
      } else if (error.message?.includes('404')) {
        alert('Producto no encontrado. Puede que ya haya sido eliminado.')
        // Remove from local state if product doesn't exist
        setItems(prev => prev.filter(p => p.id !== id))
      } else if (error.message?.includes('unauthorized') || error.message?.includes('permission')) {
        alert('No tienes permisos para eliminar este producto.')
      } else if (error.message?.includes('network') || error.message?.includes('timeout')) {
        alert('Error de conexión. Por favor, intenta nuevamente.')
      } else {
        alert('Error eliminando producto: ' + (error.message || 'Error desconocido'))
      }
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-green-800">Mis productos</h1>
        <Link to="/dashboard/products/new" className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-green-700">Publicar nuevo</Link>
      </div>
      {loading && <p>Cargando…</p>}
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 text-sm font-medium text-amber-700 hover:text-amber-900 underline"
          >
            Recargar ahora
          </button>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
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
