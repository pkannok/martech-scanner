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
    advertiser_id=fypp50u;
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

  assert.equal(vendors.every(vendor => vendor.confidence?.level === 'medium'), true);
  assert.equal(vendors.every(vendor => vendor.confidence?.score === 0.65), true);
});
