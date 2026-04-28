const http = require('http');
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const { discoverPages } = require('../src/discovery');
const { buildSummaryMarkdown, collectAllIds, summarizeVendors } = require('../src/reporting');
const { runScanPass } = require('../src/scanner');
const { normalizeDomain } = require('../src/utils');

let browser;

before(async () => {
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
});

function sendHtml(res, body, statusCode = 200, headers = {}) {
  res.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
    ...headers,
  });
  res.end(body);
}

function listen(server) {
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}

async function withFixtureServer(routes, fn) {
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, 'http://127.0.0.1');
    const handler = routes[requestUrl.pathname] || routes['*'];

    if (!handler) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    handler(req, res, requestUrl);
  });

  await listen(server);
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  try {
    return await fn(origin);
  } finally {
    await close(server);
  }
}

async function closedOrigin() {
  const server = http.createServer();
  await listen(server);
  const { port } = server.address();
  await close(server);
  return `http://127.0.0.1:${port}`;
}

async function fulfillVendorRequests(context) {
  await context.route('**/*', route => {
    const requestUrl = new URL(route.request().url());

    if (requestUrl.hostname === '127.0.0.1') {
      return route.continue();
    }

    if (requestUrl.hostname === 'www.googletagmanager.com' && requestUrl.pathname === '/gtm.js') {
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.google_tag_manager = window.google_tag_manager || {};',
      });
    }

    if (requestUrl.hostname === 'www.googletagmanager.com' && requestUrl.pathname === '/ns.html') {
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>GTM iframe</title>',
      });
    }

    if (requestUrl.hostname === 'connect.facebook.net') {
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.fbq = window.fbq || function() {};',
      });
    }

    return route.fulfill({ status: 204, body: '' });
  });
}

function keys(items, format) {
  return new Set(items.map(format));
}

function byKey(items, format) {
  return new Map(items.map(item => [format(item), item]));
}

test('normalizeDomain keeps paths and queries while removing hashes and trailing slashes', () => {
  assert.equal(
    normalizeDomain(' Example.com/products/?ref=test#details '),
    'https://example.com/products/?ref=test'
  );
  assert.equal(normalizeDomain('http://www.example.com/'), 'http://www.example.com');
  assert.throws(() => normalizeDomain(''), /Missing required argument/);
});

test('discoverPages parses browser links and keeps only prioritized same-site URLs', async () => {
  await withFixtureServer(
    {
      '/': (req, res) => sendHtml(res, `
        <!doctype html>
        <title>Discovery fixture</title>
        <a href="/shop">Shop</a>
        <a href="/pricing">Pricing</a>
        <a href="/about?campaign=1#team">About</a>
        <a href="/privacy">Privacy</a>
        <a href="https://external.example/contact">External</a>
        <a href="mailto:test@example.com">Email</a>
        <a href="javascript:void(0)">Script link</a>
      `),
    },
    async origin => {
      const urls = await discoverPages(browser, origin, 5000, 4);

      assert.equal(urls.every(url => url === origin || url.startsWith(`${origin}/`)), true);
      assert.ok(urls.includes(origin));
      assert.ok(urls.includes(`${origin}/shop`));
      assert.ok(urls.includes(`${origin}/pricing`));
      assert.ok(urls.includes(`${origin}/about?campaign=1#team`));
      assert.equal(urls.some(url => url.includes('external.example')), false);
      assert.equal(urls.some(url => url.startsWith('mailto:')), false);
      assert.equal(urls.some(url => url.includes('/privacy')), false);
    }
  );
});

test('runScanPass detects vendors and IDs from real Playwright page activity', async () => {
  await withFixtureServer(
    {
      '/': (req, res) => sendHtml(
        res,
        `
          <!doctype html>
          <html>
            <head>
              <title>Scanner Fixture</title>
              <script>
                window.dataLayer = window.dataLayer || [];
                window.google_tag_manager = { 'GTM-LOCAL1': {} };
                window.gtag = function() { window.dataLayer.push(Array.from(arguments)); };
                window.fbq = function() {};
                window.ttq = { load: function() {} };

                gtag('config', 'G-LOCAL123');
                gtag('config', 'AW-123456789');
                fbq('init', '123456789012345');
                ttq.load('D4T4CDJC77U9L5PIV3O0');
                window.__INITIAL_STATE__ = { ttd: 'advertiser_id=abc123' };

                fetch('https://insight.adsrvr.org/track/cei?advertiser_id=abc123', {
                  method: 'POST',
                  mode: 'no-cors',
                  body: 'ttd_pid=abc123'
                }).catch(function() {});
              </script>
              <script src="https://www.googletagmanager.com/gtm.js?id=GTM-LOCAL1"></script>
              <script src="https://connect.facebook.net/en_US/fbevents.js"></script>
            </head>
            <body>
              <button type="button">Open menu</button>
              <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-LOCAL1"></iframe>
              <img alt="" src="https://www.facebook.com/tr?id=123456789012345&ev=PageView">
              <img alt="" src="https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=D4T4CDJC77U9L5PIV3O0">
            </body>
          </html>
        `,
        200,
        {
          'set-cookie': 'fixture_session=abc123; Path=/; SameSite=Lax',
        }
      ),
    },
    async origin => {
      const report = await runScanPass(browser, origin, `${origin}/`, 5000, false, {
        prepareContext: fulfillVendorRequests,
      });

      assert.equal(report.status, 'ok');
      assert.equal(report.statusCode, 200);
      assert.equal(report.title, 'Scanner Fixture');
      assert.ok(report.cookies.some(cookie => cookie.name === 'fixture_session'));

      const vendors = summarizeVendors([report]);
      const vendorSet = keys(vendors, vendor => `${vendor.name}|${vendor.category}|${vendor.source}`);
      const vendorMap = byKey(vendors, vendor => `${vendor.name}|${vendor.category}|${vendor.source}`);
      assert.ok(vendorSet.has('Google Tag Manager|tag_manager|network'));
      assert.ok(vendorSet.has('Google Tag Manager|tag_manager|script'));
      assert.ok(vendorSet.has('Google Tag Manager|tag_manager|source_code'));
      assert.ok(vendorSet.has('Google Analytics|analytics|source_code'));
      assert.ok(vendorSet.has('Google Ads / DoubleClick|media_pixel|source_code'));
      assert.ok(vendorSet.has('Meta Pixel|media_pixel|network'));
      assert.ok(vendorSet.has('Meta Pixel|media_pixel|script'));
      assert.ok(vendorSet.has('TikTok Pixel|media_pixel|network'));
      assert.ok(vendorSet.has('The Trade Desk|media_pixel|network'));
      assert.equal(vendorMap.get('The Trade Desk|media_pixel|network').confidence.level, 'high');
      assert.equal(vendorMap.get('Google Tag Manager|tag_manager|script').confidence.score, 0.85);
      assert.equal(vendorMap.get('Google Analytics|analytics|source_code').confidence.level, 'medium');

      const idSet = keys(collectAllIds([report]), id => `${id.type}|${id.value}`);
      assert.ok(idSet.has('GTM Container ID|GTM-LOCAL1'));
      assert.ok(idSet.has('GA4 Measurement ID|G-LOCAL123'));
      assert.ok(idSet.has('Google Ads ID|AW-123456789'));
      assert.ok(idSet.has('Facebook Pixel ID|123456789012345'));
      assert.ok(idSet.has('TikTok Pixel ID|D4T4CDJC77U9L5PIV3O0'));
      assert.ok(idSet.has('The Trade Desk Advertiser ID|abc123'));

      assert.ok(report.networkFindings.some(finding =>
        finding.vendor.name === 'The Trade Desk' &&
        finding.method === 'POST' &&
        finding.confidence?.level === 'high'
      ));
      assert.ok(report.scriptFindings.some(script =>
        script.src.includes('googletagmanager.com/gtm.js') &&
        script.confidence?.score === 0.85
      ));
    }
  );
});

test('buildSummaryMarkdown formats detected, empty, and failed page output', () => {
  const pageReports = [
    {
      url: 'https://example.test/',
      status: 'ok',
      statusCode: 200,
      error: null,
      title: 'Example',
      consentClicks: ['accept all'],
      networkFindings: [
        {
          vendor: { name: 'Meta Pixel', category: 'media_pixel' },
          ids: [{ type: 'Facebook Pixel ID', value: '123456789012345' }],
        },
      ],
      scriptFindings: [],
      cookies: [{ name: 'session' }],
      pageGlobals: { globals: { dataLayer: { present: true } } },
      sourceSignals: {
        googleGlobals: { dataLayerPresent: true },
        htmlIds: [],
        inlineScriptIds: [{ type: 'GA4 Measurement ID', value: 'G-LOCAL123' }],
        noscriptIds: [],
      },
    },
    {
      url: 'https://example.test/broken',
      status: 'failed',
      statusCode: null,
      error: 'net::ERR_CONNECTION_REFUSED',
      title: '',
      consentClicks: [],
      networkFindings: [],
      scriptFindings: [],
      cookies: [],
      pageGlobals: { globals: {} },
      sourceSignals: {
        googleGlobals: {},
        htmlIds: [],
        inlineScriptIds: [],
        noscriptIds: [],
      },
    },
  ];

  const finalReport = {
    domain: 'https://example.test',
    scannedAt: '2026-04-28T00:00:00.000Z',
    config: {
      maxPages: 2,
      enableConsentClick: true,
    },
    pageReports,
    vendors: summarizeVendors(pageReports),
    ids: collectAllIds(pageReports),
  };

  const markdown = buildSummaryMarkdown(finalReport);

  assert.match(markdown, /^# Martech Scan Summary v2\.3/);
  assert.match(markdown, /- \*\*Domain:\*\* https:\/\/example\.test/);
  assert.match(markdown, /- \*\*Meta Pixel\*\* \(media_pixel\) via network - confidence: high \(95%\)/);
  assert.match(markdown, /- \*\*Facebook Pixel ID:\*\* `123456789012345`/);
  assert.match(markdown, /- Consent clicks: accept all/);
  assert.match(markdown, /- Error: net::ERR_CONNECTION_REFUSED/);
  assert.match(markdown, /  - GA4 Measurement ID: G-LOCAL123/);
});

test('runScanPass reports navigation failures without throwing', async () => {
  const origin = await closedOrigin();
  const report = await runScanPass(browser, origin, origin, 500, false);

  assert.equal(report.status, 'failed');
  assert.equal(report.statusCode, null);
  assert.match(report.error, /ERR_CONNECTION_REFUSED|net::ERR|ECONNREFUSED|Timeout/i);
  assert.deepEqual(report.networkFindings, []);
  assert.deepEqual(report.scriptFindings, []);
});
