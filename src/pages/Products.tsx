export default function Products() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-2xl font-bold text-green-800">Catálogo de productos</h1>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="overflow-hidden rounded-xl border border-green-100 bg-white p-4 shadow-sm">
            <div className="h-36 w-full rounded-md bg-gradient-to-br from-green-50 to-gray-100" />
            <h3 className="mt-3 text-lg font-semibold">Producto {i}</h3>
            <p className="text-sm text-gray-600">Descripción breve del producto.</p>
            <button className="mt-4 w-full rounded-md bg-green-600 px-3 py-2.5 text-white shadow hover:bg-green-700">Agregar al carrito</button>
          </div>
        ))}
      </div>
    </main>
  )
}
