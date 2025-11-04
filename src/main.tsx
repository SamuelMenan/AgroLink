import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import appLogo from './assets/logo.png'
import { AuthProvider } from './context/AuthContext'

// Ensure favicon points to the built asset URL (works in dev and prod)
const ensureFavicon = () => {
  const linkId = 'agrolink-favicon'
  let link = document.querySelector<HTMLLinkElement>(`link#${linkId}`)
  if (!link) {
    link = document.createElement('link')
    link.id = linkId
    link.rel = 'icon'
    link.type = 'image/png'
    document.head.appendChild(link)
  }
  link.href = appLogo
}

ensureFavicon()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
