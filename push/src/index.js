import { buildPushPayload } from '@block65/webcrypto-web-push';

const allowedOrigin = env => env.ALLOWED_ORIGIN || 'https://jjdsnt.github.io';
const cors = env => ({
  'access-control-allow-origin': allowedOrigin(env),
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  vary: 'Origin',
});
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers });

async function readJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return null;
  }
}

async function tokensMatch(provided, expected) {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

function browserOriginAllowed(request, env) {
  const origin = request.headers.get('origin');
  return !origin || origin === allowedOrigin(env);
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const headers = cors(env);

  if (request.method === 'OPTIONS') {
    return browserOriginAllowed(request, env)
      ? new Response(null, { status: 204, headers })
      : json({ error: 'origin not allowed' }, 403, headers);
  }

  if (url.pathname === '/health' && request.method === 'GET') {
    return json({ ok: true }, 200, headers);
  }

  if (url.pathname === '/vapid-public-key' && request.method === 'GET') {
    return json(
      { publicKey: env.VAPID_PUBLIC_KEY },
      200,
      { ...headers, 'cache-control': 'public, max-age=300' },
    );
  }

  if (url.pathname === '/subscribe' && request.method === 'POST') {
    if (!browserOriginAllowed(request, env)) return json({ error: 'origin not allowed' }, 403, headers);
    const subscription = await readJson(request);
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return json({ error: 'invalid subscription' }, 400, headers);
    }
    await env.DB.prepare(`INSERT INTO subscriptions(endpoint,p256dh,auth,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,updated_at=CURRENT_TIMESTAMP`)
      .bind(subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth)
      .run();
    return json({ ok: true }, 201, headers);
  }

  if (url.pathname === '/subscribe' && request.method === 'DELETE') {
    if (!browserOriginAllowed(request, env)) return json({ error: 'origin not allowed' }, 403, headers);
    const subscription = await readJson(request);
    if (!subscription?.endpoint) return json({ error: 'invalid subscription' }, 400, headers);
    await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint=?').bind(subscription.endpoint).run();
    return json({ ok: true }, 200, headers);
  }

  if (url.pathname === '/notify' && request.method === 'POST') {
    const authorization = request.headers.get('authorization') || '';
    const providedToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!await tokensMatch(providedToken, env.PUSH_API_TOKEN)) {
      return json({ error: 'unauthorized' }, 401, headers);
    }

    const event = await readJson(request);
    if (!event || typeof event !== 'object') return json({ error: 'invalid event' }, 400, headers);

    const payload = JSON.stringify({
      title: 'Observatório 2030',
      body: event.title || 'Novo marco registrado',
      url: event.url || './#marcos',
      tag: event.id || 'observatorio-2030-marco',
    });
    const rows = (await env.DB.prepare('SELECT endpoint,p256dh,auth FROM subscriptions').all()).results || [];
    let sent = 0;
    let removed = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
        const push = await buildPushPayload(
          { data: payload, options: { ttl: 86400 } },
          subscription,
          { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
        );
        const response = await fetch(subscription.endpoint, push);
        if (response.status === 404 || response.status === 410) {
          await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint=?').bind(row.endpoint).run();
          removed += 1;
        } else if (response.ok) {
          sent += 1;
        } else {
          failed += 1;
        }
      } catch (error) {
        failed += 1;
        console.error(JSON.stringify({ message: 'push delivery failed', error: String(error) }));
      }
    }

    console.log(JSON.stringify({ message: 'push batch completed', sent, removed, failed }));
    return json({ ok: true, sent, removed, failed }, 200, headers);
  }

  return json({ error: 'not found' }, 404, headers);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error(JSON.stringify({
        message: 'unhandled request error',
        path: new URL(request.url).pathname,
        error: String(error),
      }));
      return json({ error: 'internal error' }, 500, cors(env));
    }
  },
};
