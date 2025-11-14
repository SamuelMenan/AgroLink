import { Link } from 'react-router-dom'

export default function SimpleHub() {
  return (
    <main className="mx-auto max-w-4xl p-4">
      <header className="rounded-lg bg-green-600 p-4 text-white">
        <h1 className="text-2xl font-extrabold">Bienvenido</h1>
        <p className="mt-1 text-sm">Esta es tu pantalla principal. Usa los botones grandes para hacer tus tareas.</p>
      </header>

      <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
    <BigButton to="/messages" icon="chat" title="Mensajes" subtitle="Habla con tus compradores" />
        <BigButton to="/dashboard/products/new" icon="add_circle" title="Publicar producto" subtitle="Publica fácil y rápido" />
        <BigButton to="/dashboard/products" icon="inventory_2" title="Mis publicaciones" subtitle="Edita o elimina" />
  { /* Mensajes ya está arriba; eliminamos duplicado */ }
    <BigButton to="/dashboard/orders" icon="list_alt" title="Pedidos" subtitle="Gestiona estados y descargas" />
    <BigButton to="/dashboard/settings" icon="manage_accounts" title="Configuración" subtitle="Perfil y privacidad" />
        <BigButton to="/dashboard/notifications" icon="notifications" title="Notificaciones" subtitle="Novedades y avisos" />
      </section>

      <section className="mt-6 rounded-lg border bg-white p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
          <span className="material-icons-outlined">route</span>
          ¿Qué hago ahora?
        </h2>
        <ol className="mt-3 space-y-2 text-gray-800">
          <li className="flex items-start gap-2"><span className="mt-0.5 h-6 w-6 flex-shrink-0 select-none rounded-full bg-green-600 text-center text-sm font-bold text-white">1</span><span>Publica tu producto con precio y una foto clara.</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 h-6 w-6 flex-shrink-0 select-none rounded-full bg-green-600 text-center text-sm font-bold text-white">2</span><span>Recibe mensajes: te avisaremos cuando alguien te escriba y podrás responder desde Mensajes.</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 h-6 w-6 flex-shrink-0 select-none rounded-full bg-green-600 text-center text-sm font-bold text-white">3</span><span>Chatea con la persona para acordar entrega y pago.</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 h-6 w-6 flex-shrink-0 select-none rounded-full bg-green-600 text-center text-sm font-bold text-white">4</span><span>Entrega el producto y confirma la venta.</span></li>
        </ol>
      </section>
    </main>
  )
}

function BigButton({ to, icon, title, subtitle }: { to: string; icon: string; title: string; subtitle: string }){
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-green-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow">
      <span className="material-icons-outlined text-3xl text-green-700">{icon}</span>
      <span>
        <span className="block text-lg font-bold text-gray-900">{title}</span>
        <span className="block text-sm text-gray-600">{subtitle}</span>
      </span>
    </Link>
  )
}
