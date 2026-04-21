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
  getHostnameSafe,
  normalizeComparableHost,
  sameSiteHost,
  sameSite,
  slugifyHostname,
};
