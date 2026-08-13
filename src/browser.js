const { DEFAULT_WAIT_AFTER_LOAD_MS, USER_AGENT_DISCOVERY, USER_AGENT_SCAN } = require('./config');
const { sleep } = require('./utils');

const CONSENT_PHRASES = ['accept', 'accept all', 'allow all', 'i agree', 'agree', 'consent', 'got it'];
const CONSENT_SELECTORS = ['button', '[role="button"]', 'input[type="button"]'];
function matchesConsentText(text) {
  return /^(accept(?: all)?(?: cookies?)?|allow all(?: cookies?)?|i agree|agree|consent|got it)$/i.test(String(text || '').trim());
}

async function hardenContext(context) {
  await context.setExtraHTTPHeaders({
    'accept-language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Google Chrome";v="135", "Chromium";v="135", "Not.A/Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  });

  await context.addInitScript(() => {
    const override = (object, property, value) => {
      try {
        Object.defineProperty(object, property, {
          configurable: true,
          get: () => value,
        });
      } catch {
        // ignore
      }
    };

    override(Navigator.prototype, 'webdriver', undefined);
    override(Navigator.prototype, 'language', 'en-US');
    override(Navigator.prototype, 'languages', ['en-US', 'en']);
    override(Navigator.prototype, 'platform', 'Win32');

    if (!window.chrome) {
      Object.defineProperty(window, 'chrome', {
        configurable: true,
        value: { runtime: {} },
      });
    }
  });
}

async function createDiscoveryContext(browser) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 960 },
    serviceWorkers: 'block',
    userAgent: USER_AGENT_DISCOVERY,
    locale: 'en-US',
  });

  await hardenContext(context);
  return context;
}

async function createScanContext(browser, options = {}) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 960 },
    serviceWorkers: 'block',
    userAgent: USER_AGENT_SCAN,
    locale: 'en-US',
    ...(options.recordHarPath
      ? {
          recordHar: {
            path: options.recordHarPath,
            mode: 'full',
          },
        }
      : {}),
  });

  await hardenContext(context);
  return context;
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

async function stimulatePageActivity(page, options = {}) {
  // Deliberate page activity is owned by the bounded observation phases.
  // Retain this compatibility hook without implicitly hovering or clicking controls.
}

module.exports = {
  createDiscoveryContext,
  createScanContext,
  safeGoto,
  stimulatePageActivity,
  CONSENT_PHRASES,
  CONSENT_SELECTORS,
  matchesConsentText,
};
