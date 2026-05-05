const test = require('node:test');
const assert = require('node:assert/strict');

const { extractIdsFromTextBlock, detectVendorFromUrl } = require('../src/detectors');
const { summarizeVendors } = require('../src/reporting');

test('extractIdsFromTextBlock captures beckons-style vendor IDs and rejects g-form', () => {
  const findings = extractIdsFromTextBlock(`
    fbq('init', '633710700486705');
    gtag('config', 'G-G5Y3RBXDG8');
    gtag('config', 'AW-17911345596');
    ttq.load('D4T4CDJC77U9L5PIV3O0');
    var campaign = 'DC-16510922';
    fetch('https://insight.adsrvr.org/track/cei?advertiser_id=fypp50u');
    var form = "g-form";
  `);

  const keys = new Set(findings.map(id => `${id.type}|${id.value}`));

  assert.ok(keys.has('Facebook Pixel ID|633710700486705'));
  assert.ok(keys.has('GA4 Measurement ID|G-G5Y3RBXDG8'));
  assert.ok(keys.has('Google Ads ID|AW-17911345596'));
  assert.ok(keys.has('DoubleClick Advertiser ID|DC-16510922'));
  assert.ok(keys.has('TikTok Pixel ID|D4T4CDJC77U9L5PIV3O0'));
  assert.ok(keys.has('The Trade Desk Advertiser ID|fypp50u'));
  assert.equal(keys.has('GA4 Measurement ID|g-form'), false);
});

test('generic query IDs require vendor URL context', () => {
  const genericFindings = extractIdsFromTextBlock(`
    https://example.com/search?id=123456789012345&pid=12345&tid=2613646378106
  `);
  const genericKeys = new Set(genericFindings.map(id => `${id.type}|${id.value}`));

  assert.equal(genericKeys.has('Facebook Pixel ID|123456789012345'), false);
  assert.equal(genericKeys.has('LinkedIn Partner ID|12345'), false);
  assert.equal(genericKeys.has('Pinterest Tag ID|2613646378106'), false);

  const scopedFindings = extractIdsFromTextBlock(`
    <img src="https://www.facebook.com/tr?id=123456789012345&ev=PageView">
    <img src="https://px.ads.linkedin.com/collect/?pid=12345&fmt=gif">
    <img src="https://ct.pinterest.com/v3/?tid=2613646378106&event=init">
  `);
  const scopedKeys = new Set(scopedFindings.map(id => `${id.type}|${id.value}`));

  assert.ok(scopedKeys.has('Facebook Pixel ID|123456789012345'));
  assert.ok(scopedKeys.has('LinkedIn Partner ID|12345'));
  assert.ok(scopedKeys.has('Pinterest Tag ID|2613646378106'));
});

test('request bodies use the vendor endpoint as ID extraction context', () => {
  const scopedFindings = extractIdsFromTextBlock('ttd_pid=abc123', {
    sourceUrl: 'https://insight.adsrvr.org/track/cei',
  });
  const genericFindings = extractIdsFromTextBlock('ttd_pid=abc123', {
    sourceUrl: 'https://example.com/track',
  });

  assert.deepEqual(scopedFindings, [{ type: 'The Trade Desk Advertiser ID', value: 'abc123' }]);
  assert.deepEqual(genericFindings, []);
});

test('detectVendorFromUrl recognizes TikTok and The Trade Desk hosts', () => {
  assert.deepEqual(
    detectVendorFromUrl('https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=D4T4CDJC77U9L5PIV3O0'),
    [{ name: 'TikTok Pixel', category: 'media_pixel' }]
  );

  assert.deepEqual(
    detectVendorFromUrl('https://insight.adsrvr.org/track/cei?advertiser_id=fypp50u'),
    [{ name: 'The Trade Desk', category: 'media_pixel' }]
  );
});

test('detectVendorFromUrl does not infer vendors from generic parameters on unrelated hosts', () => {
  assert.deepEqual(
    detectVendorFromUrl('https://example.com/track?id=123456789012345&pid=12345&tid=2613646378106&ttd_pid=abc123'),
    []
  );
});

test('summarizeVendors infers source-code vendors from non-google IDs', () => {
  const vendors = summarizeVendors([
    {
      sourceSignals: {
        htmlIds: [
          { type: 'Facebook Pixel ID', value: '633710700486705' },
          { type: 'DoubleClick Advertiser ID', value: 'DC-16510922' },
          { type: 'TikTok Pixel ID', value: 'D4T4CDJC77U9L5PIV3O0' },
          { type: 'The Trade Desk Advertiser ID', value: 'fypp50u' },
        ],
        inlineScriptIds: [{ type: 'GA4 Measurement ID', value: 'G-G5Y3RBXDG8' }],
        noscriptIds: [],
        googleGlobals: {},
      },
      networkFindings: [],
      scriptFindings: [],
    },
  ]);

  const keys = new Set(vendors.map(vendor => `${vendor.name}|${vendor.category}|${vendor.source}`));

  assert.ok(keys.has('Google Analytics|analytics|source_code'));
  assert.ok(keys.has('Google Ads / DoubleClick|media_pixel|source_code'));
  assert.ok(keys.has('Meta Pixel|media_pixel|source_code'));
  assert.ok(keys.has('TikTok Pixel|media_pixel|source_code'));
  assert.ok(keys.has('The Trade Desk|media_pixel|source_code'));

  assert.equal(vendors.every(vendor => vendor.evidence?.type === 'inferred'), true);
  assert.equal(vendors.every(vendor => vendor.confidence?.level === 'medium'), true);
  assert.equal(vendors.every(vendor => vendor.confidence?.score === 0.65), true);
});
