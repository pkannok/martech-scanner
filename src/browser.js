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

async function stimulatePageActivity(page, options = {}) {
  const richMode = options.rich === true;

  try {
    await page.mouse.move(720, 120).catch(() => {});

    const scrollSteps = await page.evaluate(() => {
      const root = document.scrollingElement || document.documentElement || document.body;
      if (!root) return [];

      const maxScroll = Math.max(0, (root.scrollHeight || 0) - window.innerHeight);
      if (maxScroll <= 0) return [0];

      return [0, 0.25, 0.5, 0.75, 1]
        .map(ratio => Math.round(maxScroll * ratio))
        .filter((value, index, values) => values.indexOf(value) === index);
    }).catch(() => [0]);

    for (const top of scrollSteps) {
      await page.evaluate(value => window.scrollTo({ top: value, behavior: 'auto' }), top).catch(() => {});
      await sleep(800);
    }

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' })).catch(() => {});
    await sleep(1200);

    const hoverTargets = await page.locator('button, [role="button"], a[href], input, [data-testid]').elementHandles().catch(() => []);
    for (const element of hoverTargets.slice(0, 6)) {
      await element.hover({ timeout: 1000 }).catch(() => {});
      await sleep(250);
    }

    if (!richMode) return;

    const startUrl = page.url();
    const clickTargets = await page
      .locator('button:not([type="submit"]), summary, [role="button"], [aria-controls], [aria-expanded]')
      .elementHandles()
      .catch(() => []);

    for (const element of clickTargets.slice(0, 8)) {
      const text = await element.innerText().catch(() => '');
      const normalizedText = String(text || '').trim().toLowerCase();

      if (/login|log in|sign in|checkout|book now|reserve|apply|submit/.test(normalizedText)) {
        continue;
      }

      await element.scrollIntoViewIfNeeded().catch(() => {});
      await element.click({ timeout: 1500 }).catch(() => {});
      await sleep(1200);

      if (page.url() !== startUrl) {
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await sleep(1000);
      }
    }

    await page.mouse.wheel(0, 1200).catch(() => {});
    await sleep(1200);
    await page.mouse.wheel(0, -1200).catch(() => {});
    await sleep(1800);
  } catch {
    // ignore
  }
}

module.exports = {
  createDiscoveryContext,
  createScanContext,
  safeGoto,
  clickConsentButtons,
  stimulatePageActivity,
  CONSENT_PHRASES,
  CONSENT_SELECTORS,
  matchesConsentText,
};
