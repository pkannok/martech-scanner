const { DEFAULT_WAIT_AFTER_LOAD_MS, USER_AGENT_DISCOVERY, USER_AGENT_SCAN } = require('./config');
const { sleep } = require('./utils');

const CONSENT_PHRASES = [
  'accept',
  'accept all',
  'allow all',
  'i agree',
  'agree',
  'consent',
  'got it',
];

const CONSENT_SELECTORS = ['button', '[role="button"]', 'input[type="button"]', 'input[type="submit"]'];

function matchesConsentText(text) {
  const normalizedText = String(text || '').trim().toLowerCase();
  if (!normalizedText) return false;

  return CONSENT_PHRASES.some(phrase => normalizedText.includes(phrase));
}

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
  const clicked = [];

  for (const selector of CONSENT_SELECTORS) {
    const elements = await page.locator(selector).elementHandles();
    for (const element of elements) {
      try {
        const rawText = (await element.innerText().catch(() => '')) || '';
        const valueText = (await element.getAttribute('value').catch(() => '')) || '';
        const ariaLabel = (await element.getAttribute('aria-label').catch(() => '')) || '';
        const text = `${rawText} ${valueText} ${ariaLabel}`.trim().toLowerCase();

        if (!text) continue;
        if (!matchesConsentText(text)) continue;

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
  CONSENT_PHRASES,
  CONSENT_SELECTORS,
  matchesConsentText,
};
