import express from 'express';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'node:dns/promises';
import net from 'node:net';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const distDir = path.join(__dirname, 'dist');

const LICENSING_URL = (process.env.LICENSING_URL || 'https://propailicense.up.railway.app').replace(/\/+$/, '');
const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
const fallbackGatewayUrl = isRailway ? 'http://gateway.railway.internal:8080' : 'http://localhost:8080';
const fallbackControlApiUrl = isRailway ? 'http://control-api.railway.internal:8080' : 'http://localhost:8788';
const GATEWAY_URL = (process.env.GATEWAY_URL || fallbackGatewayUrl).replace(/\/+$/, '');
const CONTROL_API_URL = (process.env.CONTROL_API_URL || fallbackControlApiUrl).replace(/\/+$/, '');
const CONTROL_UI_REDIRECT_URL = (process.env.CONTROL_UI_REDIRECT_URL || process.env.VITE_APP_URL || 'https://app.propai.live')
  .replace(/\/+$/, '');
const META_WA_VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || '';
const META_WA_APP_SECRET = process.env.META_WA_APP_SECRET || process.env.WHATSAPP_APP_SECRET || '';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || process.env.PROPAI_GATEWAY_TOKEN || '';
const CONTROL_ADMIN_KEY = process.env.CONTROL_ADMIN_KEY || process.env.ADMIN_KEY || '';

app.use('/webhooks/whatsapp', express.raw({ type: '*/*' }));
app.use(express.json({ limit: '1mb' }));

function sendProxyError(res, message) {
  res.status(502).json({ ok: false, message });
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  return `http://${rawUrl}`;
}

async function probeTcp(host, port, timeoutMs = 1500) {
  return await new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finalize = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finalize({ ok: true }));
    socket.on('timeout', () => finalize({ ok: false, error: 'timeout' }));
    socket.on('error', (err) => finalize({ ok: false, error: err.message }));
    socket.connect(port, host);
  });
}

function resolveProviderKeys() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY),
    xai: Boolean(process.env.XAI_API_KEY),
    elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
  };
}

async function forwardJson(res, url, body) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const payload = await response.json().catch(() => ({}));
    res.status(response.status).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upstream request failed.';
    sendProxyError(res, message);
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'propai-web' });
});

app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

app.get('/api/health/ui', (_req, res) => {
  const indexPath = path.join(distDir, 'index.html');
  const exists = fs.existsSync(indexPath);
  res.status(exists ? 200 : 500).json({
    ok: exists,
    indexPath,
  });
});

app.get('/api/health/control', async (_req, res) => {
  try {
    const response = await fetch(`${CONTROL_API_URL}/health`, {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    res.status(response.status).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Control API not reachable.';
    res.status(503).json({ ok: false, message, controlApiUrl: CONTROL_API_URL });
  }
});

app.get('/api/health/full', async (_req, res) => {
  const uiIndexPath = path.join(distDir, 'index.html');
  const uiOk = fs.existsSync(uiIndexPath);

  let controlOk = false;
  let controlStatus = 503;
  let controlPayload = null;
  try {
    const response = await fetch(`${CONTROL_API_URL}/health`, {
      headers: { Accept: 'application/json' },
    });
    controlStatus = response.status;
    controlPayload = await response.json().catch(() => ({}));
    controlOk = response.ok;
  } catch (error) {
    controlPayload = {
      ok: false,
      message: error instanceof Error ? error.message : 'Control API not reachable.',
      controlApiUrl: CONTROL_API_URL,
    };
  }

  let gatewayOk = false;
  let gatewayStatus = 503;
  let gatewayPayload = null;
  try {
    const response = await fetch(`${GATEWAY_URL}/healthz`, {
      headers: { Accept: 'application/json' },
    });
    gatewayStatus = response.status;
    gatewayPayload = await response.json().catch(() => ({}));
    gatewayOk = response.ok;
  } catch (error) {
    gatewayPayload = {
      ok: false,
      message: error instanceof Error ? error.message : 'Gateway not reachable.',
      gatewayUrl: GATEWAY_URL,
    };
  }

  const ok = uiOk && controlOk && gatewayOk;
  res.status(ok ? 200 : 503).json({
    ok,
    ui: { ok: uiOk, indexPath: uiIndexPath },
    control: { ok: controlOk, status: controlStatus, payload: controlPayload },
    gateway: { ok: gatewayOk, status: gatewayStatus, payload: gatewayPayload },
  });
});

app.get('/api/health/setup', async (_req, res) => {
  const providerKeys = resolveProviderKeys();
  const anyProvider = Object.values(providerKeys).some(Boolean);
  const gatewayAuthConfigured = Boolean(GATEWAY_TOKEN);

  let controlOk = false;
  let gatewayUrlConfigured = false;
  let gatewayTokenConfigured = false;
  try {
    const response = await fetch(`${CONTROL_API_URL}/health`, {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    controlOk = response.ok;
    gatewayUrlConfigured = Boolean(payload.gatewayUrlConfigured);
    gatewayTokenConfigured = Boolean(payload.gatewayTokenConfigured);
  } catch (error) {
    controlOk = false;
  }

  const controlLinkOk = gatewayUrlConfigured && gatewayTokenConfigured;
  const ok = gatewayAuthConfigured && anyProvider && controlLinkOk;

  res.status(ok ? 200 : 503).json({
    ok,
    gateway: {
      authTokenConfigured: gatewayAuthConfigured,
      providerKeys,
      anyProvider,
      licensingUrl: LICENSING_URL,
    },
    control: {
      ok: controlOk,
      gatewayUrlConfigured,
      gatewayTokenConfigured,
    },
  });
});

app.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && token === META_WA_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }
  res.status(403).send('Verification failed.');
});

app.post('/webhooks/whatsapp', async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (META_WA_APP_SECRET) {
    const signature = req.get('x-hub-signature-256') || '';
    const expected = `sha256=${crypto.createHmac('sha256', META_WA_APP_SECRET).update(rawBody).digest('hex')}`;
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      res.status(401).send('Invalid signature.');
      return;
    }
  }

  try {
    const response = await fetch(`${GATEWAY_URL}/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: rawBody.length ? rawBody : Buffer.from('{}'),
    });
    const text = await response.text();
    res.status(response.status).send(text || 'ok');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook forward failed.';
    res.status(502).send(message);
  }
});

app.get('/api/gateway/health', async (_req, res) => {
  try {
    const response = await fetch(`${GATEWAY_URL}/healthz`, {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    res.status(response.status).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gateway not reachable.';
    res.status(503).json({
      ok: false,
      message,
      gatewayUrl: GATEWAY_URL,
    });
  }
});

app.post('/api/gateway/chat', async (req, res) => {
  try {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(GATEWAY_TOKEN ? { Authorization: `Bearer ${GATEWAY_TOKEN}` } : {}),
      'x-propai-message-channel': 'webcontrol',
    };
    const response = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body ?? {}),
    });
    const payloadText = await response.text();
    try {
      const payload = payloadText ? JSON.parse(payloadText) : {};
      res.status(response.status).json(payload);
    } catch {
      res.status(response.status).send(payloadText);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gateway chat failed.';
    res.status(502).json({ ok: false, message });
  }
});

app.get('/api/diag/gateway', async (_req, res) => {
  const normalized = normalizeUrl(GATEWAY_URL);
  if (!normalized) {
    res.status(500).json({ ok: false, message: 'GATEWAY_URL not set.' });
    return;
  }

  let url;
  try {
    url = new URL(normalized);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Invalid gateway URL.',
      gatewayUrl: GATEWAY_URL,
    });
    return;
  }

  const host = url.hostname;
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  let lookupResult = null;
  let lookupError = null;
  try {
    lookupResult = await dns.lookup(host, { all: true });
  } catch (error) {
    lookupError = error instanceof Error ? error.message : 'DNS lookup failed.';
  }

  const tcpResult = await probeTcp(host, port);
  res.json({
    ok: true,
    gatewayUrl: GATEWAY_URL,
    normalizedUrl: normalized,
    host,
    port,
    dns: lookupResult,
    dnsError: lookupError,
    tcp: tcpResult,
  });
});

app.post('/api/licensing/request', (req, res) => {
  forwardJson(res, `${LICENSING_URL}/v1/activations/request`, req.body);
});

app.post('/api/licensing/activate', (req, res) => {
  forwardJson(res, `${LICENSING_URL}/v1/activations/activate`, req.body);
});

app.post('/api/licensing/refresh', (req, res) => {
  forwardJson(res, `${LICENSING_URL}/v1/activations/refresh`, req.body);
});

app.post('/api/licensing/verify', (req, res) => {
  forwardJson(res, `${LICENSING_URL}/verify`, req.body);
});

app.get(/^\/app(\/.*)?$/, (req, res) => {
  const suffix = req.originalUrl.replace(/^\/app/, '');
  res.redirect(302, `${CONTROL_UI_REDIRECT_URL}${suffix}`);
});

app.all('/api/admin/*', async (req, res) => {
  if (!CONTROL_ADMIN_KEY) {
    res.status(403).json({ ok: false, message: 'Admin access not configured.' });
    return;
  }
  const upstreamPath = req.originalUrl.replace('/api/admin', '/v1/admin');
  const url = `${CONTROL_API_URL}${upstreamPath}`;
  try {
    const headers = {
      Accept: 'application/json',
      'x-admin-key': CONTROL_ADMIN_KEY,
    };
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }
    const options = {
      method: req.method,
      headers,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = JSON.stringify(req.body ?? {});
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    res.status(response.status).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Admin request failed.';
    sendProxyError(res, message);
  }
});

app.all('/api/control/*', async (req, res) => {
  const upstreamPath = req.originalUrl.replace('/api/control', '');
  const url = `${CONTROL_API_URL}${upstreamPath}`;
  try {
    const headers = {
      Accept: 'application/json',
      ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
    };
    const options = {
      method: req.method,
      headers,
    };
    if (!['GET', 'HEAD'].includes(req.method)) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(req.body ?? {});
    }
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    res.status(response.status).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upstream request failed.';
    sendProxyError(res, message);
  }
});

app.use(express.static(distDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`propai website listening on :${port}`);
});
