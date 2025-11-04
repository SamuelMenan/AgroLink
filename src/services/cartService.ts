export type CartItem = {
  id: string
  name: string
  price: number
  image_url?: string
  seller_id?: string
  quantity: number
}

const LS_KEY = 'agrolink_cart'

function read(): CartItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as CartItem[]) : []
  } catch {
    return []
  }
}

function write(items: CartItem[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items))
  // Notificar a la UI que cambió el carrito
  window.dispatchEvent(new CustomEvent('cart:updated'))
}

export function listCart(): CartItem[] { return read() }
export function getCartCount(): number { return read().reduce((acc, it) => acc + (it.quantity || 0), 0) }

export function addToCart(item: Omit<CartItem, 'quantity'>, qty = 1) {
  const items = read()
  const idx = items.findIndex((i) => i.id === item.id)
  if (idx >= 0) {
    items[idx].quantity += qty
  } else {
    items.push({ ...item, quantity: qty })
  }
  write(items)
}

export function removeFromCart(id: string) {
  const items = read().filter((i) => i.id !== id)
  write(items)
}

export function setItemQuantity(id: string, qty: number) {
  const items = read()
  const idx = items.findIndex((i) => i.id === id)
  if (idx >= 0) {
    if (qty <= 0) items.splice(idx, 1)
    else items[idx].quantity = qty
    write(items)
  }
}

export function clearCart() { write([]) }

export function onCartChange(cb: () => void) {
  const handler = () => cb()
  window.addEventListener('cart:updated', handler)
  return () => window.removeEventListener('cart:updated', handler)
}
