// Coletor OmniRouter — consome a API do OmniRoute (Apple Containers em localhost:20128).
// Autentica com INITIAL_PASSWORD=admin para obter o cookie auth_token e consulta /api/usage/analytics.

const BASE_URL = process.env.OMNIROUTER_URL || 'http://localhost:20128';
const PASSWORD = process.env.OMNIROUTER_PASSWORD || '';
const MIN_INTERVAL = 30000; // 30 segundos de cache
const REQUEST_TIMEOUT_MS = 6000;

let cache = { at: 0, data: null };
let authToken = null;
let lastAttempt = 0;

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });

  if (!res.ok) {
    throw new Error(`Falha no login do OmniRouter: HTTP ${res.status}`);
  }

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/auth_token=([^;]+)/);
    if (match) {
      authToken = match[1];
      return authToken;
    }
  }

  const json = await res.json().catch(() => ({}));
  if (json.token) {
    authToken = json.token;
    return authToken;
  }

  throw new Error('Não foi possível extrair o auth_token do OmniRouter');
}

function shape(analytics) {
  const s = analytics.summary || analytics || {};
  const totalTokens = s.totalTokens || 0;
  const promptTokens = s.promptTokens || 0;
  const completionTokens = s.completionTokens || 0;
  const totalRequests = s.totalRequests || 0;
  const totalCost = Number(s.totalCost || 0);

  const byModel = Array.isArray(analytics.byModel) ? analytics.byModel : [];
  const topModels = byModel.slice(0, 4).map((m) => ({
    name: m.model || 'unknown',
    provider: m.provider || '',
    requests: m.requests || 0,
    tokens: m.totalTokens || 0,
    cost: m.cost || 0,
  }));

  return {
    tool: 'omnirouter',
    label: 'Omni Router',
    confidence: 'live',
    totalTokens,
    promptTokens,
    completionTokens,
    totalRequests,
    totalCost,
    topModels,
    activeProviders: (analytics.byProvider || []).length || 1,
  };
}

async function collect() {
  const now = Date.now();
  if (cache.data && now - cache.at < MIN_INTERVAL) {
    return { ...cache.data, confidence: 'cached' };
  }

  if (now - lastAttempt < 10000) {
    if (cache.data) return { ...cache.data, confidence: 'stale' };
    return { tool: 'omnirouter', label: 'Omni Router', confidence: 'cooldown', error: 'aguardando intervalo' };
  }
  lastAttempt = now;

  try {
    if (!authToken) {
      await login();
    }

    let res = await fetch(`${BASE_URL}/api/usage/analytics`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Cookie: `auth_token=${authToken}`,
        Accept: 'application/json',
      },
    });

    if (res.status === 401 || res.status === 403) {
      // Token expirou, tenta relogar uma vez
      await login();
      res = await fetch(`${BASE_URL}/api/usage/analytics`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Cookie: `auth_token=${authToken}`,
          Accept: 'application/json',
        },
      });
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = await res.json();
    const data = shape(raw);
    cache = { at: now, data };
    return data;
  } catch (err) {
    const errorMsg = String(err.message || err);
    if (cache.data) {
      return { ...cache.data, confidence: 'stale', error: errorMsg };
    }
    return {
      tool: 'omnirouter',
      label: 'Omni Router',
      confidence: 'error',
      error: errorMsg,
      totalTokens: 0,
      totalRequests: 0,
      totalCost: 0,
      topModels: [],
    };
  }
}

module.exports = { collect };
