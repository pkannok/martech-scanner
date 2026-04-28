const fs = require('fs');

function parseArgs(argv) {
  const out = {};
  for (const arg of argv.slice(2)) {
    if (!arg.startsWith('--')) continue;
    const [rawKey, ...rest] = arg.slice(2).split('=');
    out[rawKey.trim()] = rest.join('=').trim() || true;
  }
  return out;
}

function normalizeDomain(input) {
  if (!input) throw new Error('Missing required argument: --domain=https://example.com');
  let value = input.trim();
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  const url = new URL(value);
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function isTrackingQueryParam(name) {
  const normalized = String(name || '').toLowerCase();
  return (
    normalized.startsWith('utm_') ||
    [
      '_ga',
      '_gl',
      'fbclid',
      'gclid',
      'gbraid',
      'wbraid',
      'mc_cid',
      'mc_eid',
      'msclkid',
      'ttclid',
    ].includes(normalized)
  );
}

function canonicalPageKey(urlString) {
  try {
    const url = new URL(urlString);
    const protocol = url.protocol.toLowerCase();
    const hostname = normalizeComparableHost(url.hostname);
    const host = url.port ? `${hostname}:${url.port}` : hostname;
    const pathname = (url.pathname || '/')
      .replace(/\/{2,}/g, '/')
      .replace(/\/+$/, '') || '/';

    const params = [];
    if (pathname !== '/') {
      for (const [name, value] of url.searchParams.entries()) {
        if (!isTrackingQueryParam(name)) params.push([name, value]);
      }
    }

    params.sort(([nameA, valueA], [nameB, valueB]) => {
      const nameCompare = nameA.localeCompare(nameB);
      return nameCompare || valueA.localeCompare(valueB);
    });

    const search = params.length
      ? `?${params.map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join('&')}`
      : '';

    return `${protocol}//${host}${pathname}${search}`;
  } catch {
    return String(urlString || '').trim().toLowerCase();
  }
}

function getHostnameSafe(urlString) {
  try {
    return new URL(urlString).hostname;
  } catch {
    return null;
  }
}

function normalizeComparableHost(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\.+/, '')
    .replace(/^www\./, '');
}

function sameSiteHost(baseHost, candidateHost) {
  const normalizedBase = normalizeComparableHost(baseHost);
  const normalizedCandidate = normalizeComparableHost(candidateHost);

  if (!normalizedBase || !normalizedCandidate) return false;

  return (
    normalizedCandidate === normalizedBase ||
    normalizedCandidate.endsWith(`.${normalizedBase}`) ||
    normalizedBase.endsWith(`.${normalizedCandidate}`)
  );
}

function sameSite(baseUrl, candidateUrl) {
  const baseHost = getHostnameSafe(baseUrl);
  const candidateHost = getHostnameSafe(candidateUrl);
  return sameSiteHost(baseHost, candidateHost);
}

function slugifyHostname(urlString) {
  const hostname = new URL(urlString).hostname;
  return hostname.replace(/[^a-z0-9.-]/gi, '_');
}

module.exports = {
  parseArgs,
  normalizeDomain,
  ensureDir,
  nowIso,
  sleep,
  dedupeBy,
  canonicalPageKey,
  getHostnameSafe,
  normalizeComparableHost,
  sameSiteHost,
  sameSite,
  slugifyHostname,
};
