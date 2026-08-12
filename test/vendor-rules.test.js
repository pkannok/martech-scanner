const test = require('node:test');
const assert = require('node:assert/strict');

const { detectVendorFromUrl } = require('../src/detectors');
const {
  VENDOR_RULES,
  evaluateVendorRules,
  evaluateCookieRules,
  evaluateGlobalRules,
  evaluateIdentifierRules,
  cookieRuleMatches,
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
  assert.equal(VENDOR_RULES.length, 12);
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

test('identifier rules extract IDs only from matching vendor contexts', () => {
  const cases = [
    ['script', 'https://www.googletagmanager.com/gtag/js?id=G-CONTEXT123', 'google-analytics', 'GA4 Measurement ID', 'G-CONTEXT123'],
    ['iframe', 'https://www.googletagmanager.com/ns.html?id=GTM-CONTEXT123', 'google-tag-manager', 'GTM Container ID', 'GTM-CONTEXT123'],
    ['request', 'https://www.facebook.com/tr?id=123456789012345&ev=PageView', 'meta-pixel', 'Facebook Pixel ID', '123456789012345'],
    ['request', 'https://insight.adsrvr.org/track/abc?ttd_pid=CONTEXT123', 'the-trade-desk', 'The Trade Desk Advertiser ID', 'CONTEXT123'],
  ];

  for (const [source, url, vendorId, type, value] of cases) {
    const matches = evaluateIdentifierRules(url, { source });
    assert.equal(matches[0].rule.id, vendorId, url);
    assert.deepEqual(matches[0].ids, [{ type, value }], url);
  }

  assert.deepEqual(evaluateIdentifierRules('https://example.com/gtag/js?id=G-CONTEXT123', { source: 'script' }), []);
  assert.deepEqual(evaluateIdentifierRules('https://example.com/tr?id=123456789012345', { source: 'request' }), []);
});

test('multiple matching rule signals remain one vendor detection', () => {
  const matches = evaluateVendorRules('https://www.googletagmanager.com/gtm.js?id=GTM-RULE123');
  assert.equal(new Set(matches.map(rule => rule.id)).size, matches.length);
  assert.deepEqual(detectVendorFromUrl('https://www.googletagmanager.com/gtm.js?id=GTM-RULE123'), [
    { name: 'Google Tag Manager', category: 'tag_manager' },
  ]);
});

test('cookie rules support exact and prefixed names without capturing values', () => {
  const findings = evaluateCookieRules([
    { name: 'mbox', value: 'sensitive-target-value', domain: 'example.test' },
    { name: '_hjSessionUser_123', value: 'sensitive-hotjar-value', domain: 'example.test' },
    { name: '__hstc', value: 'sensitive-hubspot-value', domain: 'example.test' },
    { name: 'fs_uid', value: 'sensitive-fullstory-value', domain: 'example.test' },
    { name: 'fs_uid', value: 'duplicate', domain: 'example.test' },
  ]);

  assert.deepEqual(findings.map(finding => finding.rule.id), [
    'adobe-target',
    'hotjar',
    'hubspot',
    'fullstory',
  ]);
  assert.deepEqual(findings.find(finding => finding.rule.id === 'hotjar').cookieNames, ['_hjSessionUser_123']);
  assert.equal(findings.some(finding => Object.hasOwn(finding, 'value')), false);
  assert.equal(cookieRuleMatches('mboxPreference', { type: 'exact', name: 'mbox' }), false);
  assert.equal(cookieRuleMatches('my_mbox_setting', { type: 'exact', name: 'mbox' }), false);
});

test('supporting-only cookies do not independently create an Adobe Target detection', () => {
  assert.deepEqual(evaluateCookieRules([{ name: 'at_check', value: '1' }]), []);
  assert.deepEqual(evaluateCookieRules([{ name: 'mboxEdgeCluster', value: 'default' }]), []);
});

test('global rules support function, queue, and namespace shapes', () => {
  const findings = evaluateGlobalRules([
    { path: '_hsq', exists: true, type: 'array' },
    { path: 'utag', exists: true, type: 'object' },
    { path: 'optimizely', exists: true, type: 'function' },
    { path: 'FS', exists: true, type: 'function' },
  ]);

  assert.deepEqual(findings.map(finding => finding.rule.id), ['hubspot', 'fullstory', 'tealium', 'optimizely']);
});

test('global rules require exact paths and compatible types', () => {
  assert.deepEqual(evaluateGlobalRules([
    { path: 'hjSettingsOnly', exists: true, type: 'object' },
    { path: 'utagHelper', exists: true, type: 'function' },
    { path: '_hsq', exists: true, type: 'string' },
  ]), []);
});
