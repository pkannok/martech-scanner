const http = require('http');
const path = require('path');
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const { discoverPages } = require('../src/discovery');
const { buildSummaryMarkdown, collectAllIds, collectVendorsByCategory, summarizeVendors } = require('../src/reporting');
const { buildDiscoveredUrlReport, buildReportPaths, dateStampFromIso, runScanPass } = require('../src/scanner');
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
        <a href="/">Home slash</a>
        <a href="/?utm_source=email">Home tracking</a>
        <a href="#top">Home hash</a>
        <a href="/shop">Shop</a>
        <a href="/shop/">Shop trailing slash</a>
        <a href="/shop?utm_campaign=spring">Shop tracking</a>
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
      assert.ok(urls.includes(`${origin}/about?campaign=1`));
      assert.equal(urls.filter(url => url === origin || url === `${origin}/` || url.startsWith(`${origin}/?`)).length, 1);
      assert.equal(urls.filter(url => url === `${origin}/shop` || url === `${origin}/shop/` || url.startsWith(`${origin}/shop?`)).length, 1);
      assert.equal(urls.some(url => url.includes('external.example')), false);
      assert.equal(urls.some(url => url.startsWith('mailto:')), false);
      assert.equal(urls.some(url => url.includes('/privacy')), false);
    }
  );
});

test('buildDiscoveredUrlReport ranks discovered URLs and marks scanned pages', () => {
  const report = buildDiscoveredUrlReport(
    [
      'https://www.example.com',
      'https://www.example.com/about',
      'https://www.example.com/shop?utm_source=email',
    ],
    [
      'https://example.com/',
      'https://example.com/shop',
    ]
  );

  assert.deepEqual(report, [
    {
      url: 'https://www.example.com',
      rank: 1,
      scanned: true,
    },
    {
      url: 'https://www.example.com/about',
      rank: 2,
      scanned: false,
    },
    {
      url: 'https://www.example.com/shop?utm_source=email',
      rank: 3,
      scanned: true,
    },
  ]);
});

test('buildReportPaths uses date-stamped names and increments daily counters', () => {
  const occupied = new Set([
    path.join('output', 'example.com_results_20260504.json'),
    path.join('output', 'example.com_summary_20260504.md'),
    path.join('output', 'example.com_results_20260504_01.json'),
  ]);

  const paths = buildReportPaths(
    'output',
    'https://example.com',
    '2026-05-04T18:00:00.000Z',
    filePath => occupied.has(filePath)
  );

  assert.equal(dateStampFromIso('2026-05-04T18:00:00.000Z'), '20260504');
  assert.equal(paths.jsonPath, path.join('output', 'example.com_results_20260504_02.json'));
  assert.equal(paths.mdPath, path.join('output', 'example.com_summary_20260504_02.md'));
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
      assert.equal(vendorMap.get('The Trade Desk|media_pixel|network').evidence.type, 'observed_firing');
      assert.equal(vendorMap.get('The Trade Desk|media_pixel|network').confidence.level, 'high');
      assert.equal(vendorMap.get('Google Tag Manager|tag_manager|script').evidence.type, 'present_in_source');
      assert.equal(vendorMap.get('Google Tag Manager|tag_manager|script').confidence.score, 0.85);
      assert.equal(vendorMap.get('Google Analytics|analytics|source_code').evidence.type, 'inferred');
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
        finding.evidence?.type === 'observed_firing' &&
        finding.confidence?.level === 'high'
      ));
      assert.ok(report.scriptFindings.some(script =>
        script.src.includes('googletagmanager.com/gtm.js') &&
        script.evidence?.type === 'present_in_source' &&
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
      scriptFindings: [
        {
          src: 'https://www.googletagmanager.com/gtag/js?id=G-LOCAL123',
          detectedVendors: [{ name: 'Google Analytics', category: 'analytics' }],
          ids: [{ type: 'GA4 Measurement ID', value: 'G-LOCAL123' }],
        },
      ],
      cookies: [{ name: 'session' }],
      diagnostics: {
        retriedThinPage: false,
        retryReason: null,
      },
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
      diagnostics: {
        retriedThinPage: false,
        retryReason: null,
      },
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
    scanUrls: ['https://example.test/', 'https://example.test/broken'],
    discovered_urls: [
      { url: 'https://example.test/', rank: 1, scanned: true },
      { url: 'https://example.test/broken', rank: 2, scanned: true },
      { url: 'https://example.test/contact', rank: 3, scanned: false },
    ],
    pageReports,
    vendors: summarizeVendors(pageReports),
    ids: collectAllIds(pageReports),
  };

  const markdown = buildSummaryMarkdown(finalReport);

  assert.match(markdown, /^# MarTech Scan Summary/);
  assert.match(markdown, /- \*\*Scanner version:\*\* 0\.3\.0/);
  assert.match(markdown, /- \*\*Report template version:\*\* 2\.7/);
  assert.match(markdown, /- \*\*Domain:\*\* https:\/\/example\.test/);
  assert.match(markdown, /## Executive Summary/);
  assert.match(markdown, /- Target: https:\/\/example\.test/);
  assert.match(markdown, /- Generated at: 2026-04-28T00:00:00\.000Z/);
  assert.match(markdown, /- Pages scanned: 2/);
  assert.match(markdown, /- Discovered URLs: 3/);
  assert.match(markdown, /- Skipped \/ not scanned URLs: 1/);
  assert.match(markdown, /- Failed pages: 1/);
  assert.match(markdown, /- Vendors detected: 3/);
  assert.match(markdown, /- IDs detected: 2/);
  assert.match(markdown, /- Consent interaction: Enabled; interaction captured on 1 of 2 page\(s\)\./);
  assert.match(markdown, /- Thin \/ low-evidence pages: 0/);
  assert.match(markdown, /browser-visible evidence from the scanned pages only/);
  assert.match(markdown, /## Scan Coverage/);
  assert.match(markdown, /Coverage is limited to the URLs discovered and selected during this run\./);
  assert.match(markdown, /- Seed \/ target: https:\/\/example\.test/);
  assert.match(markdown, /- Total pages scanned: 2/);
  assert.match(markdown, /- Total URLs discovered: 3/);
  assert.match(markdown, /- Discovered but not scanned: 1/);
  assert.match(markdown, /### Scanned Pages/);
  assert.match(markdown, /- https:\/\/example\.test\//);
  assert.match(markdown, /  - Evidence counts: 1 network, 1 scripts, 1 source IDs, 1 cookies/);
  assert.match(markdown, /- https:\/\/example\.test\/contact/);
  assert.match(markdown, /  - Reason: not recorded/);
  assert.match(markdown, /  - Discovery rank: rank 3/);
  assert.match(markdown, /### Failed or Partial Pages/);
  assert.match(markdown, /- https:\/\/example\.test\/broken/);
  assert.match(markdown, /  - Reason: net::ERR_CONNECTION_REFUSED/);
  assert.match(markdown, /  - Partial evidence captured: no/);
  assert.match(markdown, /## Evidence Type Guide/);
  assert.match(markdown, /Evidence type describes where the scanner saw a signal/);
  assert.match(markdown, /\*\*Network evidence:\*\* A browser request to a recognized vendor endpoint was observed during the scan\./);
  assert.match(markdown, /\*\*Script evidence:\*\* A loaded script URL or third-party script element matched a known vendor rule or contained a known ID\./);
  assert.match(markdown, /\*\*Source evidence:\*\* A known ID or signal was found in HTML, inline JavaScript, global previews, or extracted source-level URL text\./);
  assert.match(markdown, /\*\*Cookie evidence:\*\* Cookies visible to the browser context were captured for a scanned page\./);
  assert.match(markdown, /\*\*Global object evidence:\*\* Known browser globals such as data layers or tag-manager objects were present on the page\./);
  assert.match(markdown, /\*\*Inferred \/ rule-match evidence:\*\* A vendor was inferred from source-level IDs, globals, or rule matches rather than a direct observed vendor request\./);
  assert.match(markdown, /does not, by itself, prove full implementation/);
  assert.match(markdown, /- \*\*Meta Pixel\*\* \(media_pixel\) via network - evidence type: Network evidence \(observed firing\) - confidence: high \(95%\)/);
  assert.match(markdown, /- \*\*Google Analytics\*\* \(analytics\) via script - evidence type: Script evidence \(present in source\) - confidence: high \(85%\)/);
  assert.match(markdown, /- \*\*Google Analytics\*\* \(analytics\) via source_code - evidence type: Source evidence \(inferred\) - confidence: medium \(65%\)/);
  assert.match(markdown, /- \*\*Facebook Pixel ID:\*\* `123456789012345` - evidence type: Network evidence/);
  assert.match(markdown, /- \*\*GA4 Measurement ID:\*\* `G-LOCAL123` - evidence type: Script evidence, Source evidence/);
  assert.match(markdown, /## Detected Vendors by Category/);
  assert.match(markdown, /### Analytics/);
  assert.match(markdown, /- \*\*Google Analytics\*\*/);
  assert.match(markdown, /  - Evidence types: Script evidence, Source evidence/);
  assert.match(markdown, /  - IDs: GA4 Measurement ID: G-LOCAL123/);
  assert.match(markdown, /  - Pages: 1 page\(s\); first seen: https:\/\/example\.test\//);
  assert.match(markdown, /### Media \/ Advertising/);
  assert.match(markdown, /- \*\*Meta Pixel\*\*/);
  assert.match(markdown, /  - Evidence types: Network evidence/);
  assert.match(markdown, /  - IDs: Facebook Pixel ID: 123456789012345/);
  assert.match(markdown, /- Consent clicks: accept all/);
  assert.match(markdown, /- Error: net::ERR_CONNECTION_REFUSED/);
  assert.match(markdown, /  - GA4 Measurement ID: G-LOCAL123 \(Source evidence\)/);
});

test('collectVendorsByCategory groups known and unknown vendor categories deterministically', () => {
  const finalReport = {
    vendors: [
      {
        name: 'Mystery Vendor',
        category: 'custom_unknown',
        source: 'network',
      },
    ],
    pageReports: [
      {
        url: 'https://example.test/',
        networkFindings: [
          {
            vendor: { name: 'Google Tag Manager', category: 'tag_manager' },
            ids: [{ type: 'GTM Container ID', value: 'GTM-LOCAL1' }],
          },
          {
            vendor: { name: 'Shopify', category: 'ecommerce' },
            ids: [],
          },
        ],
        scriptFindings: [
          {
            detectedVendors: [{ name: 'Optimizely', category: 'experimentation' }],
            ids: [],
          },
        ],
        sourceSignals: {
          googleGlobals: {},
          htmlIds: [],
          inlineScriptIds: [],
          noscriptIds: [],
        },
      },
    ],
  };

  const grouped = collectVendorsByCategory(finalReport);

  assert.equal(grouped.get('Tag Management')[0].name, 'Google Tag Manager');
  assert.equal(grouped.get('Ecommerce / Platform')[0].name, 'Shopify');
  assert.equal(grouped.get('Personalization / Experimentation')[0].name, 'Optimizely');
  assert.equal(grouped.get('Other / Uncategorized')[0].name, 'Mystery Vendor');
});

test('buildSummaryMarkdown caps long coverage lists', () => {
  const pageReports = Array.from({ length: 21 }, (_, index) => ({
    url: `https://example.test/page-${index + 1}`,
    status: 'ok',
    statusCode: 200,
    error: null,
    title: '',
    consentClicks: [],
    networkFindings: [],
    scriptFindings: [],
    cookies: [],
    diagnostics: {
      retriedThinPage: false,
      retryReason: null,
    },
    pageGlobals: { globals: {} },
    sourceSignals: {
      googleGlobals: {},
      htmlIds: [],
      inlineScriptIds: [],
      noscriptIds: [],
    },
  }));

  const discoveredUrls = Array.from({ length: 21 }, (_, index) => ({
    url: `https://example.test/skipped-${index + 1}`,
    rank: index + 1,
    scanned: false,
  }));

  const markdown = buildSummaryMarkdown({
    domain: 'https://example.test',
    scannedAt: '2026-04-28T00:00:00.000Z',
    config: {
      maxPages: 21,
      enableConsentClick: false,
    },
    scanUrls: pageReports.map(page => page.url),
    discovered_urls: discoveredUrls,
    pageReports,
    vendors: [],
    ids: [],
  });

  assert.match(markdown, /- 1 additional scanned page\(s\) omitted from Markdown\./);
  assert.match(markdown, /- 1 additional discovered-but-not-scanned URL\(s\) omitted from Markdown\./);
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
