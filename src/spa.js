const { canonicalPageKey, sleep } = require('./utils');

const CONTROL_EXCLUSION_RE = /logout|log out|delete|remove|checkout|cart|buy|purchase|payment|billing|unsubscribe|sign in|signin|login|account|download|submit|register|unsubscribe/i;
const FILE_RE = /\.(?:pdf|zip|docx?|xlsx?|csv|jpg|jpeg|png|gif|webp|svg|mp4|mp3)(?:$|\?)/i;
const ROUTE_OBSERVER_KEY = '__martechScannerRouteObserver';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isSafeSpaCandidate(candidate, currentUrl) {
  if (!candidate?.href || candidate.download || candidate.target && candidate.target !== '_self') return false;
  let url;
  let current;
  try {
    url = new URL(candidate.href, currentUrl);
    current = new URL(currentUrl);
  } catch {
    return false;
  }
  if (url.origin !== current.origin || url.hash && canonicalPageKey(url.href) === canonicalPageKey(current.href)) return false;
  if (FILE_RE.test(url.pathname + url.search)) return false;
  if (CONTROL_EXCLUSION_RE.test(`${candidate.text} ${url.pathname} ${url.search}`)) return false;
  if (canonicalPageKey(url.href) === canonicalPageKey(current.href)) return false;
  return true;
}

async function findSpaRouteCandidate(page, currentUrl = page.url()) {
  const candidates = await page.locator('a[href]').elementHandles().catch(() => []);
  for (const element of candidates) {
    const candidate = await element.evaluate(node => ({
      href: node.href,
      text: node.innerText || node.getAttribute('aria-label') || node.getAttribute('title') || '',
      target: node.target || '',
      download: node.hasAttribute('download'),
    })).catch(() => null);
    if (!candidate || !isSafeSpaCandidate(candidate, currentUrl)) continue;
    if (!(await element.isVisible().catch(() => false))) continue;
    return { element, href: candidate.href, text: normalizeText(candidate.text).slice(0, 150) };
  }
  return null;
}

async function installRouteObserver(page) {
  await page.evaluate(key => {
    if (window[key]) return;
    const events = [];
    const record = type => events.push({ type, url: window.location.href, at: Date.now() });
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        record(method);
        return result;
      };
    }
    window.addEventListener('popstate', () => record('popstate'));
    window[key] = { events };
  }, ROUTE_OBSERVER_KEY).catch(() => {});
}

async function activateSpaRoute(page, candidate, options = {}) {
  const routeFrom = page.url();
  const result = {
    detected: true,
    attempted: true,
    success: false,
    clientSide: false,
    routeFrom,
    routeTo: null,
    controlText: candidate.text,
    candidateUrl: candidate.href,
    failure: null,
  };

  await installRouteObserver(page);
  try {
    await candidate.element.scrollIntoViewIfNeeded().catch(() => {});
    await candidate.element.click({ timeout: options.clickTimeoutMs || 2000, noWaitAfter: true });
    const deadline = Date.now() + (options.routeTimeoutMs || 2000);
    while (Date.now() < deadline) {
      if (page.url() !== routeFrom) break;
      await sleep(50);
    }
    result.routeTo = page.url();
    if (result.routeTo === routeFrom) {
      result.failure = 'URL did not change after route activation';
      return result;
    }
    const observerPresent = await page.evaluate(key => Boolean(window[key]), ROUTE_OBSERVER_KEY).catch(() => false);
    result.clientSide = observerPresent;
    if (!observerPresent) {
      result.failure = 'full document navigation detected';
      return result;
    }
    result.success = true;
    return result;
  } catch (error) {
    result.routeTo = page.url();
    result.failure = String(error.message || error).slice(0, 300);
    return result;
  }
}

async function observeSpaRoute(page, options = {}) {
  const currentUrl = page.url();
  const candidate = await findSpaRouteCandidate(page, currentUrl);
  if (!candidate) return { detected: false, attempted: false, success: false, reason: 'no safe same-origin route candidate' };
  return activateSpaRoute(page, candidate, options);
}

module.exports = { observeSpaRoute, findSpaRouteCandidate, activateSpaRoute, isSafeSpaCandidate };
