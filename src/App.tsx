import { Routes, Route, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'  
import { ErrorBoundary } from './components/ErrorBoundary'
import SystemMonitor from './components/SystemMonitor'    
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'       
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Cart from './pages/Cart'
import NotFound from './pages/NotFound'
import PublishProduct from './pages/products/PublishProduct'
import MyProducts from './pages/products/MyProducts'      
import EditProduct from './pages/products/EditProduct'    
import SimpleHub from './pages/SimpleHub'
import OrdersDashboard from './pages/orders/OrdersDashboard'
import AccountPrivacy from './pages/settings/AccountPrivacy'
import OAuthCallback from './pages/OAuthCallback'
import CatalogManagement from './pages/dashboard/CatalogManagement'
import { Messages } from './pages/Messages'

function App() {
  

  // Handler global para casos donde Supabase redirige al origen con hash (#access_token=...) sin pasar por /oauth/callback
  function GlobalOAuthHandler() {
    const navigate = useNavigate()
    // Ejecuta una sola vez al montar
    if (typeof window !== 'undefined') {
      const h = window.location.hash || ''
      if (h.includes('access_token=')) {
        const search = window.location.search || ''
        const nextParam = new URLSearchParams(search).get('next') || '/simple'
        const target = `/oauth/callback?next=${encodeURIComponent(nextParam)}${h}`
        try {
          window.location.replace(target)
        } catch {
          navigate(`/oauth/callback?next=${encodeURIComponent(nextParam)}`)
        }
      }
    }
    return null
  }

  const appContent = (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased">
        <GlobalOAuthHandler />
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/simple" element={<SimpleHub />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/dashboard/products" element={<MyProducts />} />
            <Route path="/dashboard/products/new" element={<PublishProduct />} />
            <Route path="/dashboard/products/:id/edit" element={<EditProduct />} />
            <Route path="/dashboard/orders" element={<OrdersDashboard />} />
            <Route path="/dashboard/settings" element={<AccountPrivacy />} />
            <Route path="/dashboard/catalog" element={<CatalogManagement />} />
          </Route>
          <Route path="/products" element={<Products />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <SystemMonitor />
      </div>
    </ErrorBoundary>
  )

  

  return appContent
}

export default App
