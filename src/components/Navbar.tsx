import { Link, NavLink } from 'react-router-dom'
import appLogo from '../assets/logo.png'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-green-50 hover:text-green-700'}`

export default function Navbar() {
  return (
    <header className="border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <img src={appLogo} alt="AgroLink" className="h-8 w-8" />
              <span className="text-lg font-bold text-green-700">AgroLink</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/" className={navItemClass} end>
                Inicio
              </NavLink>
              <NavLink to="/products" className={navItemClass}>
                Productos
              </NavLink>
              <NavLink to="/dashboard" className={navItemClass}>
                Panel
              </NavLink>
              <NavLink to="/cart" className={navItemClass}>
                Carrito
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <NavLink to="/login" className={navItemClass}>
              Iniciar sesión
            </NavLink>
            <NavLink to="/register" className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium border ${isActive ? 'bg-green-700 text-white border-green-700' : 'border-green-600 text-green-700 hover:bg-green-600 hover:text-white'}`
            }>
              Registrarse
            </NavLink>
          </div>
        </div>
      </div>
    </header>
  )
}
