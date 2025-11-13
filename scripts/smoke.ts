// Simple smoke test script for backend endpoints.
// Run with: npx ts-node scripts/smoke.ts (if ts-node installed) or transpile.
// Using native fetch (Node 18+).

const API = process.env.API_BASE || 'http://localhost:8080/api';

type JsonBody = Record<string, unknown> | null | undefined
async function json(method: string, path: string, body?: JsonBody, token?: string) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function run() {
  console.log('--- Smoke test start ---');
  // AUTH
  const email = `smoke_${Date.now()}@test.local`;
  const password = 'Smoke123!';
  const signUp = await json('POST', '/auth/sign-up', { email, password, data: { full_name: 'Smoke Tester' } });
  const access = signUp.access_token; const refresh = signUp.refresh_token;
  console.log('SignUp OK user:', signUp.user?.id);
  // REFRESH
  const refreshed = await json('POST', '/auth/refresh', { refresh_token: refresh });
  console.log('Refresh OK new access length:', refreshed.access_token?.length);

  // PRODUCTS CRUD
  const created = await json('POST', '/products', { name: 'Smoke Product', price: 12.34, description: 'Test', active: true }, access);
  const productId = Array.isArray(created) ? created[0]?.id : created?.id;
  console.log('Product created id:', productId);
  const list = await json('GET', '/products?select=*');
  console.log('Products total (approx):', Array.isArray(list) ? list.length : list);
  const updated = await json('PATCH', `/products/${productId}`, { description: 'Updated Smoke' }, access);
  console.log('Product updated result:', updated);

  // REVIEWS
  const review = await json('POST', '/reviews', { product_id: productId, rating: 5, comment: 'Excelente' }, access);
  console.log('Review created:', review);
  const reviews = await json('GET', `/reviews/by-product/${productId}`);
  console.log('Reviews count:', Array.isArray(reviews) ? reviews.length : reviews);

  // ORDERS
  const order = await json('POST', '/orders', { product_id: productId, quantity: 2 }, access);
  const orderId = Array.isArray(order) ? order[0]?.id : order?.id;
  console.log('Order created id:', orderId);
  const ordersBuyer = await json('GET', `/orders/by-buyer/${signUp.user.id}`, undefined, access);
  console.log('Orders by buyer count:', Array.isArray(ordersBuyer) ? ordersBuyer.length : ordersBuyer);

  // MESSAGES
  const conv = await json('POST', '/conversations', {}, access);
  const convId = Array.isArray(conv) ? conv[0]?.id : conv?.id;
  console.log('Conversation id:', convId);
  const msg = await json('POST', '/messages', { conversation_id: convId, sender_id: signUp.user.id, plaintext: 'Hola desde smoke' }, access);
  console.log('Message inserted:', msg);
  const msgs = await json('GET', `/messages?conversationId=${convId}`, undefined, access);
  console.log('Messages fetched:', Array.isArray(msgs) ? msgs.length : msgs);

  // NOTIFICATIONS (list unread count)
  const notifs = await json('GET', `/notifications/by-user/${signUp.user.id}?limit=5`, undefined, access);
  console.log('Notifications fetched:', Array.isArray(notifs) ? notifs.length : notifs);
  const unreadRows = await json('GET', `/notifications/unread-count/${signUp.user.id}`, undefined, access);
  console.log('Unread count:', Array.isArray(unreadRows) ? unreadRows.length : unreadRows);

  console.log('--- Smoke test complete ---');
}

run().catch(e => { console.error('Smoke test failed:', e); process.exit(1); });
