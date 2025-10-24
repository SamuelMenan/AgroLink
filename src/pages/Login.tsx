export default function Login() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold text-green-800">Iniciar sesión</h1>
      <form className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20" placeholder="tu@email.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Contraseña</label>
          <input type="password" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
        </div>
        <button type="submit" className="w-full rounded-md bg-green-600 px-4 py-2.5 font-medium text-white shadow hover:bg-green-700">Entrar</button>
      </form>
    </main>
  )
}
