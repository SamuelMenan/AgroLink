export default function Dashboard() {
  return (
    <main className="mx-auto max-w-7xl p-4">
      <h1 className="text-2xl font-bold text-green-700">Panel del campesino</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded border p-4">
          <h2 className="font-semibold">Subir productos</h2>
          <p className="text-sm text-gray-600">Publica nuevos productos con fotos y precios.</p>
        </div>
        <div className="rounded border p-4">
          <h2 className="font-semibold">Ventas</h2>
          <p className="text-sm text-gray-600">Revisa pedidos y estado de pagos.</p>
        </div>
        <div className="rounded border p-4">
          <h2 className="font-semibold">Perfil</h2>
          <p className="text-sm text-gray-600">Edita información de tu cuenta.</p>
        </div>
      </div>
    </main>
  )
}
