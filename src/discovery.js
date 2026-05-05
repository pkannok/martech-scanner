const { PRIORITY_KEYWORDS } = require('./config');
const { canonicalPageKey, dedupeBy, normalizeComparableHost, sameSite } = require('./utils');
const { safeGoto, createDiscoveryContext } = require('./browser');

// Tunable URL priority weights. Host diversity is additive so path intent,
// discovery order, and same-site filtering still participate in final ranking.
const SCORE_WEIGHTS = {
  homepage: 100,
  shallowPath: 10,
  pathKeyword: 20,
  highIntentPathKeyword: 40,
  distinctSameSiteHost: 35,
  highSignalSubdomain: 25,
  lowValueSubdomain: -70,
  lowValuePath: -30,
  external: -1000,
};

const HIGH_INTENT_PATH_KEYWORDS = new Set([
  'account',
  'book',
  'booking',
  'cart',
  'checkout',
  'contact',
  'demo',
  'join',
  'login',
  'log-in',
  'pricing',
  'register',
  'reserve',
  'reservation',
  'shop',
  'signin',
  'sign-in',
  'store',
  'subscribe',
  'trial',
]);

const HIGH_SIGNAL_SUBDOMAIN_LABELS = new Set([
  'account',
  'app',
  'blog',
  'book',
  'booking',
  'checkout',
  'go',
  'help',
  'login',
  'offers',
  'shop',
  'store',
  'support',
]);

const LOW_VALUE_SUBDOMAIN_LABELS = new Set([
  'assets',
  'cdn',
  'file',
  'files',
  'font',
  'fonts',
  'image',
  'images',
  'img',
  'media',
  'static',
  'video',
  'videos',
]);

function normalizeDiscoveredUrl(url) {
  const parsed = new URL(url);
  parsed.hash = '';
  const normalized = parsed.toString();
  return parsed.pathname === '/' && !parsed.search ? normalized.replace(/\/$/, '') : normalized;
}

function getHostLabels(hostname) {
  return normalizeComparableHost(hostname)
    .split('.')
    .filter(Boolean);
}

function getHostnameDiversityScore(candidateUrl, seedUrl) {
  try {
    const candidate = new URL(candidateUrl);
    const seed = new URL(seedUrl);

    if (!sameSite(seedUrl, candidateUrl)) return SCORE_WEIGHTS.external;

    const candidateHost = normalizeComparableHost(candidate.hostname);
    const seedHost = normalizeComparableHost(seed.hostname);
    if (!candidateHost || !seedHost || candidateHost === seedHost) return 0;

    let score = SCORE_WEIGHTS.distinctSameSiteHost;
    const candidateLabels = getHostLabels(candidate.hostname);
    const seedLabels = getHostLabels(seed.hostname);
    const seedSuffix = `.${seedHost}`;
    const subdomainLabels = candidateHost.endsWith(seedSuffix)
      ? candidateHost.slice(0, -seedSuffix.length).split('.').filter(Boolean)
      : candidateLabels.filter(label => !seedLabels.includes(label));

    if (subdomainLabels.some(label => HIGH_SIGNAL_SUBDOMAIN_LABELS.has(label))) {
      score += SCORE_WEIGHTS.highSignalSubdomain;
    }

    if (subdomainLabels.some(label => LOW_VALUE_SUBDOMAIN_LABELS.has(label))) {
      score += SCORE_WEIGHTS.lowValueSubdomain;
    }

    return score;
  } catch {
    return SCORE_WEIGHTS.external;
  }
}

function scoreDiscoveredUrl(baseUrl, candidateUrl) {
  let score = 0;

  try {
    const url = new URL(candidateUrl);
    const pathname = url.pathname.toLowerCase();

    if (pathname === '/' || pathname === '') score += SCORE_WEIGHTS.homepage;
    if (pathname.split('/').length <= 3) score += SCORE_WEIGHTS.shallowPath;

    for (const keyword of PRIORITY_KEYWORDS) {
      if (!pathname.includes(keyword)) continue;
      score += HIGH_INTENT_PATH_KEYWORDS.has(keyword)
        ? SCORE_WEIGHTS.highIntentPathKeyword
        : SCORE_WEIGHTS.pathKeyword;
    }

    if (/privacy|terms|cookie-policy|sitemap|feed|rss|pdf|jpg|png|svg|gif|webp|mp4|avi|mov|zip/i.test(pathname)) {
      score += SCORE_WEIGHTS.lowValuePath;
    }

    score += getHostnameDiversityScore(candidateUrl, baseUrl);
  } catch {
    score += SCORE_WEIGHTS.external;
  }

  return score;
}

function rankedDiscoveredUrls(baseUrl, urls) {
  return dedupeBy(
    urls
      .filter(url => sameSite(baseUrl, url))
      .map((url, index) => ({
        url: normalizeDiscoveredUrl(url),
        index,
      }))
      .sort((a, b) => {
        const scoreDelta = scoreDiscoveredUrl(baseUrl, b.url) - scoreDiscoveredUrl(baseUrl, a.url);
        if (scoreDelta) return scoreDelta;
        return a.index - b.index;
      })
      .map(item => item.url),
    canonicalPageKey
  );
}

function hostDiversityKey(url) {
  try {
    return normalizeComparableHost(new URL(url).hostname);
  } catch {
    return '';
  }
}

function prioritizeScanUrls(seedUrl, discoveredUrls, maxPages, options = {}) {
  const limit = Number.isFinite(maxPages) ? Math.max(0, maxPages) : Infinity;
  const rankedUrls = rankedDiscoveredUrls(seedUrl, [seedUrl, ...(discoveredUrls || [])]);
  const seedKey = canonicalPageKey(seedUrl);
  const selected = [];
  const selectedKeys = new Set();

  const addUrl = url => {
    if (selected.length >= limit) return false;
    const key = canonicalPageKey(url);
    if (selectedKeys.has(key)) return false;
    selected.push(url);
    selectedKeys.add(key);
    return true;
  };

  addUrl(normalizeDiscoveredUrl(seedUrl));

  const bestByHost = new Map();
  for (const url of rankedUrls) {
    if (canonicalPageKey(url) === seedKey) continue;
    const hostKey = hostDiversityKey(url);
    if (!hostKey || bestByHost.has(hostKey)) continue;
    bestByHost.set(hostKey, url);
  }

  for (const url of bestByHost.values()) {
    addUrl(url);
  }

  for (const url of rankedUrls) {
    addUrl(url);
  }

  return selected.slice(0, limit);
}

async function discoverPages(browser, baseUrl, timeout, maxPages) {
  const context = await createDiscoveryContext(browser);
  const page = await context.newPage();

  const visit = await safeGoto(page, baseUrl, timeout);
  if (!visit.ok) {
    await context.close();
    throw new Error(`Failed to open seed page ${baseUrl}: ${visit.error}`);
  }

  const results = await page.evaluate((origin) => {
    const urls = new Set([origin]);

    const anchors = Array.from(document.querySelectorAll('a[href]'));
    for (const a of anchors) {
      try {
        const href = a.getAttribute('href');
        if (!href) continue;
        if (
          href.startsWith('#') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          href.startsWith('javascript:')
        ) {
          continue;
        }
        const absolute = new URL(href, origin).toString();
        urls.add(absolute);
      } catch {
        // ignore
      }
    }

    return Array.from(urls);
  }, baseUrl);

  await context.close();

  const rankedUrls = rankedDiscoveredUrls(baseUrl, results);

  if (!Number.isFinite(maxPages)) return rankedUrls;

  return prioritizeScanUrls(baseUrl, rankedUrls, maxPages);
}

module.exports = {
  discoverPages,
  getHostnameDiversityScore,
  prioritizeScanUrls,
  scoreDiscoveredUrl,
};
