import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import appLogo from '../assets/logo.png'
import { getCartCount, onCartChange } from '../services/cartService'
import { useEffect, useState } from 'react'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-green-50 hover:text-green-700'}`

export default function Navbar() {
  const { user, signOut } = useAuth()
  const [cartCount, setCartCount] = useState<number>(() => getCartCount())
  useEffect(()=>{
    const off = onCartChange(()=> setCartCount(getCartCount()))
    // también actualizar al montar (por si cambió en otra vista)
    setCartCount(getCartCount())
    return off
  }, [])
  const initials = (user?.full_name || user?.email || '')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

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
              <NavLink to="/cart" className={(args)=> navItemClass(args) + ' relative'}>
                Carrito
                {cartCount > 0 && (
                  <span className="absolute -right-2 -top-2 inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{cartCount}</span>
                )}
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="flex items-center gap-2 rounded-full bg-green-50 px-2 py-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
                    {initials || 'U'}
                  </div>
                  <span className="hidden sm:block text-sm text-gray-700 max-w-[180px] truncate">{user.full_name || user.email}</span>
                </div>
                <NavLink to="/dashboard/settings" className={(args)=> navItemClass(args) + ' flex items-center justify-center'} aria-label="Configuración">
                  <span className="material-icons-outlined text-xl">settings</span>
                  <span className="sr-only">Configuración</span>
                </NavLink>
                <button
                  onClick={async () => { await signOut() }}
                  className="px-3 py-2 rounded-md text-sm font-medium border border-red-600 text-red-700 hover:bg-red-600 hover:text-white"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navItemClass}>
                  Iniciar sesión
                </NavLink>
                <NavLink to="/dashboard/settings" className={(args)=> navItemClass(args) + ' flex items-center justify-center'} aria-label="Configuración">
                  <span className="material-icons-outlined text-xl">settings</span>
                  <span className="sr-only">Configuración</span>
                </NavLink>
                <NavLink to="/register" className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium border ${isActive ? 'bg-green-700 text-white border-green-700' : 'border-green-600 text-green-700 hover:bg-green-600 hover:text-white'}`
                }>
                  Registrarse
                </NavLink>
              </>
            )}
          </div>
        </div>
      </div>
      
    </header>
  )
}
