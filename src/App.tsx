import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import PhoneRecovery from './pages/PhoneRecovery'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Cart from './pages/Cart'
import NotFound from './pages/NotFound'
import PublishProduct from './pages/products/PublishProduct'
import MyProducts from './pages/products/MyProducts'
import EditProduct from './pages/products/EditProduct'
// RealtimeNotifications eliminado en migración a backend-only.
import NotificationsPage from './pages/notifications/NotificationsPage'
import SimpleHub from './pages/SimpleHub'
import OrdersDashboard from './pages/orders/OrdersDashboard'
import AccountPrivacy from './pages/settings/AccountPrivacy'
import OAuthCallback from './pages/OAuthCallback'
import CatalogManagement from './pages/dashboard/CatalogManagement'
import { Messages } from './pages/Messages'

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/phone-recovery" element={<PhoneRecovery />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/simple" element={<SimpleHub />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/dashboard/products" element={<MyProducts />} />
          <Route path="/dashboard/products/new" element={<PublishProduct />} />
          <Route path="/dashboard/products/:id/edit" element={<EditProduct />} />
          <Route path="/dashboard/notifications" element={<NotificationsPage />} />
          <Route path="/dashboard/orders" element={<OrdersDashboard />} />
          <Route path="/dashboard/settings" element={<AccountPrivacy />} />
          <Route path="/dashboard/catalog" element={<CatalogManagement />} />
        </Route>
        <Route path="/products" element={<Products />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

export default App
