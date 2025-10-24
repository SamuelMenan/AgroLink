import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl p-4 text-center">
      <h1 className="text-3xl font-bold text-green-700">404</h1>
      <p className="mt-2 text-gray-600">La página que buscas no existe.</p>
      <Link to="/" className="mt-4 inline-block rounded bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700">Volver al inicio</Link>
    </main>
  )
}
