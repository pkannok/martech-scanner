const { DEFAULT_WAIT_AFTER_LOAD_MS, USER_AGENT_DISCOVERY, USER_AGENT_SCAN } = require('./config');
const { sleep } = require('./utils');

async function createDiscoveryContext(browser) {
  return browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 960 },
    serviceWorkers: 'block',
    userAgent: USER_AGENT_DISCOVERY,
  });
}

async function createScanContext(browser) {
  return browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 960 },
    serviceWorkers: 'block',
    userAgent: USER_AGENT_SCAN,
  });
}

async function safeGoto(page, url, timeout) {
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await sleep(DEFAULT_WAIT_AFTER_LOAD_MS);
    return { ok: true, statusCode: response ? response.status() : null };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function clickConsentButtons(page) {
  const phrases = [
    'accept',
    'accept all',
    'allow all',
    'i agree',
    'agree',
    'consent',
    'got it',
    'continue',
  ];

  const selectors = ['button', '[role="button"]', 'input[type="button"]', 'input[type="submit"]', 'a'];
  const clicked = [];

  for (const selector of selectors) {
    const elements = await page.locator(selector).elementHandles();
    for (const element of elements) {
      try {
        const rawText = (await element.innerText().catch(() => '')) || '';
        const valueText = (await element.getAttribute('value').catch(() => '')) || '';
        const ariaLabel = (await element.getAttribute('aria-label').catch(() => '')) || '';
        const text = `${rawText} ${valueText} ${ariaLabel}`.trim().toLowerCase();

        if (!text) continue;
        if (!phrases.some(p => text.includes(p))) continue;

        await element.scrollIntoViewIfNeeded().catch(() => {});
        await element.click({ timeout: 2000 }).catch(() => {});
        clicked.push(text.slice(0, 150));
        await sleep(2500);

        if (clicked.length >= 2) return [...new Set(clicked)];
      } catch {
        // ignore
      }
    }
  }

  return [...new Set(clicked)];
}

module.exports = {
  createDiscoveryContext,
  createScanContext,
  safeGoto,
  clickConsentButtons,
};