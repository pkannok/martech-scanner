const { PRIORITY_KEYWORDS } = require('./config');
const { sameSite } = require('./utils');
const { safeGoto, createDiscoveryContext } = require('./browser');

function scoreDiscoveredUrl(baseUrl, candidateUrl) {
  let score = 0;

  try {
    const url = new URL(candidateUrl);
    const pathname = url.pathname.toLowerCase();

    if (pathname === '/' || pathname === '') score += 100;
    if (pathname.split('/').length <= 3) score += 10;

    for (const keyword of PRIORITY_KEYWORDS) {
      if (pathname.includes(keyword)) score += 20;
    }

    if (/privacy|terms|cookie-policy|sitemap|feed|rss|pdf|jpg|png|svg|gif|webp|mp4|avi|mov|zip/i.test(pathname)) {
      score -= 30;
    }

    if (!sameSite(baseUrl, candidateUrl)) score -= 1000;
  } catch {
    score -= 1000;
  }

  return score;
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

  return results
    .filter(url => sameSite(baseUrl, url))
    .sort((a, b) => scoreDiscoveredUrl(baseUrl, b) - scoreDiscoveredUrl(baseUrl, a))
    .slice(0, maxPages);
}

module.exports = {
  discoverPages,
  scoreDiscoveredUrl,
};