import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AIChat } from '../components/AIChat'
import { aiService } from '../services/aiService'

export default function Home() {
  const { user } = useAuth()
  const sellTo = user ? '/dashboard/products/new' : '/login?intent=publish&next=/dashboard/products/new'
  if (user) return <Navigate to="/simple" replace />
  return (
    <main>
      {/* Hero */}
      <section className="bg-gradient-to-b from-green-50 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-green-800 sm:text-5xl">AgroLink</h1>
          <p className="mt-4 max-w-2xl text-lg text-gray-700">
            Conectamos directamente a los campesinos con los consumidores para eliminar intermediarios,
            mejorar ingresos y ofrecer productos frescos y justos.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/products" className="inline-flex items-center rounded-md bg-green-600 px-5 py-2.5 text-white shadow hover:bg-green-700">Explorar productos</Link>
            <Link to={sellTo} className="inline-flex items-center rounded-md border border-green-600 px-5 py-2.5 text-green-700 hover:bg-green-600 hover:text-white">Vender en AgroLink</Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Precios justos</h3>
              <p className="mt-2 text-sm text-gray-600">Más ingresos para el productor, mejor precio para el consumidor.</p>
            </div>
            <div className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Productos frescos</h3>
              <p className="mt-2 text-sm text-gray-600">Del campo a tu mesa, sin largas cadenas de distribución.</p>
            </div>
            <div className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Impacto social</h3>
              <p className="mt-2 text-sm text-gray-600">Apoya la economía rural y el desarrollo sostenible.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Panel del usuario autenticado */}
      
      {/* Asistente de IA */}
      <section className="bg-gradient-to-b from-gray-50 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Asistente Agrícola Inteligente
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-600">
              Obtén consejos expertos sobre agricultura, cultivos y técnicas agrícolas con nuestro asistente de IA especializado.
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <AIChat 
              suggestedQuestions={aiService.getSuggestedQuestions()}
              maxHeight="500px"
              title="Asistente AgroLink"
              placeholder="Pregúntame sobre agricultura, cultivos, técnicas de siembra, manejo de plagas..."
            />
          </div>
        </div>
      </section>
    </main>
  )
}
