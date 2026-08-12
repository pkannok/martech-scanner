const test = require('node:test');
const assert = require('node:assert/strict');

const { detectVendorFromUrl } = require('../src/detectors');
const {
  VENDOR_RULES,
  evaluateVendorRules,
  vendorIdForName,
} = require('../src/detection/vendorRules');

const cases = [
  {
    name: 'Google Analytics script URL',
    source: 'script',
    url: 'https://www.googletagmanager.com/gtag/js?id=G-RULE123',
    expected: 'google-analytics',
  },
  {
    name: 'Google Tag Manager iframe URL',
    source: 'iframe',
    url: 'https://www.googletagmanager.com/ns.html?id=GTM-RULE123',
    expected: 'google-tag-manager',
  },
  {
    name: 'Meta Pixel request URL',
    source: 'request',
    url: 'https://www.facebook.com/tr?id=123456789012345&ev=PageView',
    expected: 'meta-pixel',
  },
  {
    name: 'TikTok runtime request URL',
    source: 'request',
    url: 'https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=RULE123456',
    expected: 'tiktok-pixel',
  },
  {
    name: 'Adobe collection host',
    source: 'request',
    url: 'https://metrics.example.omtrdc.net/b/ss/example/1',
    expected: 'adobe-experience-cloud',
  },
];

test('declarative vendor rules detect representative scoped positive signals', () => {
  for (const scenario of cases) {
    const matches = evaluateVendorRules(scenario.url, { source: scenario.source });
    assert.deepEqual(matches.map(rule => rule.id), [scenario.expected], scenario.name);
  }
});

test('declarative vendor rules reject lookalike artifacts without vendor context', () => {
  const lookalikes = [
    'https://example.com/gtag/js?id=G-RULE123',
    'https://cdn.example.com/library.js?name=googletagmanager',
    'https://example.com/tr?id=123456789012345',
    'https://example.com/analytics.tiktok.com/events.js',
    'https://example.com/omtrdc.net/collect',
  ];

  for (const url of lookalikes) {
    assert.deepEqual(evaluateVendorRules(url), [], url);
  }
});

test('migrated rules preserve public display-name output and stable internal IDs', () => {
  assert.equal(VENDOR_RULES.length, 5);
  assert.equal(vendorIdForName('Google Analytics'), 'google-analytics');
  assert.deepEqual(
    detectVendorFromUrl('https://www.googletagmanager.com/gtag/js?id=G-RULE123'),
    [{ name: 'Google Analytics', category: 'analytics' }]
  );
  assert.deepEqual(
    detectVendorFromUrl('https://www.facebook.com/tr?id=123456789012345&ev=PageView'),
    [{ name: 'Meta Pixel', category: 'media_pixel' }]
  );
});

test('multiple matching rule signals remain one vendor detection', () => {
  const matches = evaluateVendorRules('https://www.googletagmanager.com/gtm.js?id=GTM-RULE123');
  assert.equal(new Set(matches.map(rule => rule.id)).size, matches.length);
  assert.deepEqual(detectVendorFromUrl('https://www.googletagmanager.com/gtm.js?id=GTM-RULE123'), [
    { name: 'Google Tag Manager', category: 'tag_manager' },
  ]);
});
