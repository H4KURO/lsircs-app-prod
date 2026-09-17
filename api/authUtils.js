const { ensureNamedContainer } = require('./cosmosClient');

// In-memory whitelist cache (5 minute TTL)
let _wlCache = null;
let _wlCacheExpiry = 0;
const WL_CACHE_TTL_MS = 5 * 60 * 1000;

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

async function getWhitelistEmails() {
  const now = Date.now();
  if (_wlCache && now < _wlCacheExpiry) return _wlCache;
  try {
    const container = await ensureNamedContainer('AllowedUsers', { partitionKey: '/id' });
    const { resources } = await container.items
      .query('SELECT c.email, c.isAllowed FROM c')
      .fetchAll();
    const set = new Set(
      resources
        .filter(u => u.isAllowed !== false && u.email)
        .map(u => u.email.toLowerCase()),
    );
    _wlCache = set;
    _wlCacheExpiry = now + WL_CACHE_TTL_MS;
    return set;
  } catch {
    // If whitelist lookup fails, return null to allow fallback to login-only check
    return null;
  }
}

/**
 * Check that the request is from a logged-in user.
 * Returns { ok: true, principal } or { ok: false, response }
 */
function requireAuth(request) {
  const principal = parseClientPrincipal(request);
  if (!principal) {
    return { ok: false, response: { status: 401, body: 'Unauthorized access. Please log in.' } };
  }
  return { ok: true, principal };
}

/**
 * Check that the request is from a logged-in AND whitelisted user.
 * Returns { ok: true, principal } or { ok: false, response }
 */
async function requireAllowedUser(request) {
  const principal = parseClientPrincipal(request);
  if (!principal) {
    return { ok: false, response: { status: 401, body: 'Unauthorized access. Please log in.' } };
  }
  const email = (principal.userDetails || '').toLowerCase();
  const whitelist = await getWhitelistEmails();
  if (whitelist !== null && !whitelist.has(email)) {
    return { ok: false, response: { status: 403, body: 'Access denied.' } };
  }
  return { ok: true, principal };
}

module.exports = { parseClientPrincipal, requireAuth, requireAllowedUser };
