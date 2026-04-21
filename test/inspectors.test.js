const test = require('node:test');
const assert = require('node:assert/strict');

const { collectCookies, inspectPageGlobals, inspectPageSourceSignals, safePreview } = require('../src/inspectors');

function withBrowserGlobals({ windowValue, documentValue }, fn) {
  const previousWindow = global.window;
  const previousDocument = global.document;

  global.window = windowValue;
  global.document = documentValue;

  try {
    return fn();
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
  }
}

test('safePreview handles circular values without throwing', () => {
  const value = { name: 'root' };
  value.self = value;

  assert.doesNotThrow(() => safePreview(value));
  assert.match(safePreview(value), /\[Circular\]/);
});

test('inspectPageGlobals tolerates circular framework globals', async () => {
  const circular = { name: 'state' };
  circular.self = circular;

  const report = await withBrowserGlobals(
    {
      windowValue: {
        location: { href: 'https://example.com' },
        dataLayer: [circular],
        adobeDataLayer: [circular],
        digitalData: circular,
        utag: { view: true },
        utag_data: circular,
        __NEXT_DATA__: circular,
        __INITIAL_STATE__: circular,
      },
      documentValue: {
        title: 'Example',
        documentElement: { outerHTML: '<html><body>shopifycloud</body></html>' },
        querySelectorAll(selector) {
          if (selector === 'a[href], button') {
            return [{ textContent: 'Cart' }];
          }

          if (selector === 'a[href], button, input, form') {
            return [{ textContent: 'Sign in', getAttribute: () => '' }];
          }

          return [];
        },
      },
    },
    () => inspectPageGlobals({ evaluate: async evaluator => evaluator() })
  );

  assert.equal(report.title, 'Example');
  assert.equal(report.globals.dataLayer.present, true);
  assert.match(report.globals.digitalData.preview, /\[Circular\]/);
  assert.match(report.globals.__NEXT_DATA__.preview, /\[Circular\]/);
});

test('inspectPageSourceSignals tolerates circular dataLayer values', async () => {
  const circular = { name: 'event' };
  circular.self = circular;

  const signals = await withBrowserGlobals(
    {
      windowValue: {
        dataLayer: [circular],
        google_tag_manager: {},
        gtag() {},
      },
      documentValue: {
        documentElement: { outerHTML: '<html><body><script>inline</script></body></html>' },
        querySelectorAll(selector) {
          if (selector === 'script:not([src])') {
            return [{ textContent: 'gtag("config","G-TEST123")' }];
          }

          if (selector === 'script[src]') {
            return [{ src: 'https://www.googletagmanager.com/gtag/js?id=G-TEST123' }];
          }

          if (selector === 'iframe[src]') {
            return [{ src: 'https://www.googletagmanager.com/ns.html?id=GTM-TEST123' }];
          }

          if (selector === 'noscript') {
            return [{ textContent: 'fallback' }];
          }

          return [];
        },
      },
    },
    () => inspectPageSourceSignals({ evaluate: async evaluator => evaluator() })
  );

  assert.equal(signals.globals.google_tag_manager, true);
  assert.equal(signals.globals.gtag, true);
  assert.match(signals.globals.dataLayerPreview, /\[Circular\]/);
  assert.equal(signals.externalScripts.length, 1);
});

test('collectCookies keeps first-party cookies and excludes lookalike third-party domains', async () => {
  const cookies = await collectCookies(
    {
      cookies: async () => [
        { name: 'root', domain: '.example.com', path: '/', value: '1', httpOnly: false, secure: true, sameSite: 'Lax', expires: -1 },
        { name: 'subdomain', domain: '.shop.example.com', path: '/', value: '2', httpOnly: false, secure: true, sameSite: 'Lax', expires: -1 },
        { name: 'www', domain: '.www.example.com', path: '/', value: '3', httpOnly: false, secure: true, sameSite: 'Lax', expires: -1 },
        { name: 'lookalike', domain: '.badexample.com', path: '/', value: '4', httpOnly: false, secure: true, sameSite: 'Lax', expires: -1 },
      ],
    },
    'https://example.com/account'
  );

  assert.deepEqual(
    cookies.map(cookie => cookie.name),
    ['root', 'subdomain', 'www']
  );
});
