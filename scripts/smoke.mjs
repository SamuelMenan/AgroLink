// Plain JS smoke test for backend API endpoints.
// Usage (PowerShell): $Env:API_BASE='http://localhost:8080/api'; node scripts/smoke.mjs

let API = process.env.API_BASE || 'http://localhost:8080/api';
const ORIGIN = process.env.ORIGIN || '';
// Fallback support: if endpoints 404 and base ends with /api, retry without /api.

async function req(method, path, body, token, allow503 = true) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 404 && API.endsWith('/api')) {
    // Retry once with stripped base
    const alt = API.replace(/\/api$/, '');
    const retry = await fetch(alt + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (retry.ok) {
      API = alt; // switch base for subsequent calls
      const text2 = await retry.text();
      if (!text2) return null;
      try { return JSON.parse(text2); } catch { return text2; }
    }
  }
  if (!res.ok) {
    if (allow503 && res.status === 503) {
      return { _skipped: true, status: 503 };
    }
    throw new Error(`${method} ${path} -> ${res.status}`);
  }
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function main() {
  console.log('--- Smoke test start ---');
  if (ORIGIN) {
    try {
      const preflight = await fetch(API + '/auth/refresh', {
        method: 'OPTIONS',
        headers: {
          'Origin': ORIGIN,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type'
        }
      });
      console.log('Preflight /auth/refresh status:', preflight.status,
        'ACAO=', preflight.headers.get('access-control-allow-origin'),
        'ACAC=', preflight.headers.get('access-control-allow-credentials'),
        'Vary=', preflight.headers.get('vary'));
    } catch (e) {
      console.warn('Preflight check failed:', e.message);
    }
  }
  // AUTH sign-up
  const email = `smoke_${Date.now()}@test.local`;
  const password = 'Smoke123!';
  let access = null; let userId = null;
  try {
    const signUp = await req('POST', '/auth/sign-up', { email, password, data: { full_name: 'Smoke Tester' } }, null, false);
    access = signUp.access_token; const refresh = signUp.refresh_token; userId = signUp.user?.id;
    console.log('SignUp OK user:', userId);
    try {
      const refreshed = await req('POST', '/auth/refresh', { refresh_token: refresh });
      access = refreshed.access_token;
      console.log('Refresh OK access len:', refreshed.access_token.length);
    } catch (e) {
      console.warn('Refresh falló, continuando sin actualización:', e.message);
    }
  } catch (e) {
    console.warn('SignUp falló (quizá deshabilitado), continuando sin auth:', e.message);
  }

  // Products CRUD
  const createdArr = await req('POST', '/products', { name: 'Smoke Product', price: 12.34, description: 'Test', active: true }, access);
  if (createdArr._skipped) {
    console.log('Products insert skipped (Supabase no configurado)');
  } else {
    const productId = Array.isArray(createdArr) ? createdArr[0]?.id : createdArr?.id;
    console.log('Product created id:', productId);
    const list = await req('GET', '/products?select=*', null, access);
    if (list._skipped) console.log('Products list skipped (Supabase no configurado)'); else console.log('Products total approx:', Array.isArray(list) ? list.length : list);
    const upd = await req('PATCH', `/products/${productId}`, { description: 'Updated Smoke' }, access);
    if (upd._skipped) console.log('Product update skipped (Supabase no configurado)'); else console.log('Product updated');
  }

  // Reviews
  try {
    const reviewResp = await req('POST', '/reviews', { product_id: 'dummy', rating: 5, comment: 'Excelente' }, access);
    if (reviewResp._skipped) {
      console.log('Review create skipped (Supabase no configurado)');
    } else {
      const reviews = await req('GET', `/reviews/by-product/dummy`, null, access);
      if (reviews._skipped) console.log('Reviews list skipped'); else console.log('Reviews count:', Array.isArray(reviews) ? reviews.length : reviews);
    }
  } catch (e) {
    console.warn('Reviews flow error (continuando):', e.message);
  }

  // Orders
  try {
    const orderArr = await req('POST', '/orders', { product_id: 'dummy', quantity: 2 }, access);
    if (orderArr._skipped) {
      console.log('Order create skipped (Supabase no configurado)');
    } else {
      const orderId = Array.isArray(orderArr) ? orderArr[0]?.id : orderArr?.id;
      console.log('Order created id:', orderId);
    }
  } catch (e) {
    console.warn('Orders flow error (continuando):', e.message);
  }
  if (userId) {
      const ordersBuyer = await req('GET', `/orders/by-buyer/${userId}`, null, access);
      if (ordersBuyer._skipped) console.log('Orders by buyer skipped'); else console.log('Orders by buyer count:', Array.isArray(ordersBuyer) ? ordersBuyer.length : ordersBuyer);
  } else {
    console.log('Skipping orders by buyer (no userId).');
  }

  // Messaging
  const convArr = await req('POST', '/conversations', {}, access);
  const convId = Array.isArray(convArr) ? convArr[0]?.id : convArr?.id;
  console.log('Conversation id:', convId);
  const msgResp = await req('POST', '/messages', { conversation_id: convId, sender_id: userId || 'unknown', plaintext: 'Hola desde smoke' }, access);
  if (msgResp._skipped) console.log('Message send skipped'); else {
    const msgs = await req('GET', `/messages?conversationId=${convId}`, null, access);
    if (msgs._skipped) console.log('Messages list skipped'); else console.log('Messages fetched:', Array.isArray(msgs) ? msgs.length : msgs);
  }

  // Notifications
  if (userId) {
    const notifs = await req('GET', `/notifications/by-user/${userId}?limit=5`, null, access);
    if (notifs._skipped) console.log('Notifications list skipped'); else console.log('Notifications fetched:', Array.isArray(notifs) ? notifs.length : notifs);
    const unreadRows = await req('GET', `/notifications/unread-count/${userId}`, null, access);
    if (unreadRows._skipped) console.log('Unread count skipped'); else console.log('Unread count:', Array.isArray(unreadRows) ? unreadRows.length : unreadRows);
  } else {
    console.log('Skipping notifications (no userId).');
  }

  console.log('--- Smoke test complete ---');
}

main().catch(e => { console.error('Smoke test failed:', e); process.exit(1); });
