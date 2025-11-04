import MessagesWidget from '../components/MessagesWidget'

export default function Dashboard() {
  return (
    <main className="mx-auto max-w-7xl p-4">
      <h1 className="text-2xl font-bold text-green-700">Panel del campesino</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <a href="/dashboard/products/new" className="rounded border p-4 transition hover:-translate-y-0.5 hover:shadow">
          <h2 className="font-semibold">Publicar productos</h2>
          <p className="text-sm text-gray-600">Publica nuevos productos con fotos y precios.</p>
        </a>
        <div className="rounded border p-4">
          <h2 className="font-semibold">Ventas</h2>
          <p className="text-sm text-gray-600">Revisa pedidos y estado de pagos.</p>
        </div>
        <a href="/dashboard/products" className="rounded border p-4 transition hover:-translate-y-0.5 hover:shadow">
          <h2 className="font-semibold">Mis publicaciones</h2>
          <p className="text-sm text-gray-600">Edita o elimina tus publicaciones.</p>
        </a>
        <a href="/dashboard/requests/incoming" className="rounded border p-4 transition hover:-translate-y-0.5 hover:shadow">
          <h2 className="font-semibold">Solicitudes recibidas</h2>
          <p className="text-sm text-gray-600">Acepta o rechaza solicitudes comerciales.</p>
        </a>
        <a href="/dashboard/requests/outgoing" className="rounded border p-4 transition hover:-translate-y-0.5 hover:shadow">
          <h2 className="font-semibold">Mis solicitudes</h2>
          <p className="text-sm text-gray-600">Historial y estado de solicitudes enviadas.</p>
        </a>
        <div className="md:col-span-3">
          <MessagesWidget />
        </div>
      </div>
    </main>
  )
}
