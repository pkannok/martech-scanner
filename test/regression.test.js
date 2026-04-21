const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadFixture(name) {
  const fixturePath = path.join(__dirname, 'fixtures', `${name}_results_v2_3.json`);
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

function vendorKeys(report) {
  return new Set((report.vendors || []).map(vendor => `${vendor.name}|${vendor.category}|${vendor.source}`));
}

function idKeys(report) {
  return new Set((report.ids || []).map(id => `${id.type}|${id.value}`));
}

function assertUnique(list, keyFn, message) {
  assert.equal(new Set(list.map(keyFn)).size, list.length, message);
}

test('saved scan fixtures keep a stable top-level report shape', () => {
  for (const name of [
    '85sixty.com',
    'beckons.com',
    'famsf.org',
    'palisadestahoe.com',
    'snowshoemtn.com',
    'traderjoes.com',
  ]) {
    const report = loadFixture(name);

    assert.match(report.domain, /^https:\/\//);
    assert.equal(Array.isArray(report.scanUrls), true);
    assert.equal(Array.isArray(report.pageReports), true);
    assert.equal(Array.isArray(report.vendors), true);
    assert.equal(Array.isArray(report.ids), true);
    assert.ok(report.pageReports.length > 0, `${name} should include scanned pages`);
    assert.ok(report.scanUrls.length > 0, `${name} should include scan urls`);
    assert.ok(report.pageReports.length <= report.config.maxPages, `${name} should respect maxPages`);

    assertUnique(report.vendors, vendor => `${vendor.name}|${vendor.category}|${vendor.source}`, `${name} vendors should already be deduped`);
    assertUnique(report.ids, id => `${id.type}|${id.value}`, `${name} ids should already be deduped`);
  }
});

test('85sixty fixture preserves wordpress and google detections', () => {
  const report = loadFixture('85sixty.com');
  const vendors = vendorKeys(report);
  const ids = idKeys(report);

  assert.ok(vendors.has('WordPress|cms|network'));
  assert.ok(vendors.has('Google Tag Manager|tag_manager|network'));
  assert.ok(vendors.has('Google Tag Manager|tag_manager|source_code'));
  assert.ok(vendors.has('Google Analytics|analytics|script'));
  assert.ok(vendors.has('Google Ads / DoubleClick|media_pixel|script'));
  assert.ok(vendors.has('Adobe Analytics / Experience Cloud|analytics|network'));

  assert.ok(ids.has('GTM Container ID|GTM-PLSL6GS'));
  assert.ok(ids.has('GA4 Measurement ID|G-CYPTKEVWNP'));
  assert.ok(ids.has('Google Ads ID|AW-986765357'));
  assert.equal(report.ids.length, 3);
});

test('beckons fixture preserves the expanded cross-vendor detections', () => {
  const report = loadFixture('beckons.com');
  const vendors = vendorKeys(report);
  const ids = idKeys(report);

  assert.equal(report.pageReports.every(page => page.statusCode === 200), true);

  assert.ok(vendors.has('WordPress|cms|network'));
  assert.ok(vendors.has('Google Analytics|analytics|network'));
  assert.ok(vendors.has('Google Ads / DoubleClick|media_pixel|network'));
  assert.ok(vendors.has('Meta Pixel|media_pixel|network'));
  assert.ok(vendors.has('TikTok Pixel|media_pixel|network'));
  assert.ok(vendors.has('The Trade Desk|media_pixel|network'));
  assert.ok(vendors.has('Meta Pixel|media_pixel|source_code'));
  assert.ok(vendors.has('Google Tag Manager|tag_manager|source_code'));
  assert.ok(vendors.has('Google Analytics|analytics|script'));
  assert.ok(vendors.has('The Trade Desk|media_pixel|script'));

  assert.ok(ids.has('GTM Container ID|GTM-PC3TL92D'));
  assert.ok(ids.has('GA4 Measurement ID|G-G5Y3RBXDG8'));
  assert.ok(ids.has('Google Ads ID|AW-17911345596'));
  assert.ok(ids.has('DoubleClick Advertiser ID|DC-16510922'));
  assert.ok(ids.has('Facebook Pixel ID|633710700486705'));
  assert.ok(ids.has('TikTok Pixel ID|D4T4CDJC77U9L5PIV3O0'));
  assert.ok(ids.has('The Trade Desk Advertiser ID|fypp50u'));
  assert.equal(report.ids.length, 8);
});

test('famsf fixture keeps detections even when some pages return 429', () => {
  const report = loadFixture('famsf.org');
  const vendors = vendorKeys(report);
  const ids = idKeys(report);

  assert.ok(report.pageReports.some(page => page.statusCode === 429), 'fixture should cover partial page failures');
  assert.ok(report.pageReports.some(page => page.statusCode === 200), 'fixture should still include successful pages');

  assert.ok(vendors.has('Shopify|ecommerce|network'));
  assert.ok(vendors.has('Google Tag Manager|tag_manager|network'));
  assert.ok(vendors.has('Meta Pixel|media_pixel|network'));
  assert.ok(vendors.has('Pinterest Tag|media_pixel|network'));
  assert.ok(vendors.has('Hotjar|session_replay|network'));
  assert.ok(vendors.has('Google Ads / DoubleClick|media_pixel|script'));

  assert.ok(ids.has('GTM Container ID|GTM-KF3V7ZD'));
  assert.ok(ids.has('GA4 Measurement ID|G-XD8ZY7FJG6'));
  assert.ok(ids.has('Google Ads ID|AW-661513348'));
  assert.ok(ids.has('UA Property ID|UA-936475-3'));
  assert.ok(ids.has('Pinterest Tag ID|2613646378106'));
});

test('traderjoes fixture keeps consent-driven adobe and google detections', () => {
  const report = loadFixture('traderjoes.com');
  const vendors = vendorKeys(report);
  const ids = idKeys(report);

  assert.ok(report.pageReports.some(page => page.consentClicks.includes('got it')), 'fixture should cover consent interaction');

  assert.ok(vendors.has('Adobe Launch|tag_manager|network'));
  assert.ok(vendors.has('Adobe Launch|tag_manager|script'));
  assert.ok(vendors.has('Adobe Analytics / Experience Cloud|analytics|network'));
  assert.ok(vendors.has('Google Tag Manager|tag_manager|network'));
  assert.ok(vendors.has('Google Analytics|analytics|script'));

  assert.ok(ids.has('GTM Container ID|GTM-PK37XV6'));
  assert.ok(ids.has('GA4 Measurement ID|G-2HMPBJHQ41'));
  assert.ok(ids.has('UA Property ID|UA-15671700-1'));
});

test('snowshoemtn fixture captures the current no-detection baseline', () => {
  const report = loadFixture('snowshoemtn.com');

  assert.equal(report.pageReports.every(page => page.statusCode === 200), true);
  assert.equal(report.vendors.length, 0);
  assert.equal(report.ids.length, 0);
});

test('palisadestahoe fixture captures the current no-detection baseline', () => {
  const report = loadFixture('palisadestahoe.com');

  assert.equal(report.pageReports.every(page => page.statusCode === 200), true);
  assert.equal(report.vendors.length, 0);
  assert.equal(report.ids.length, 0);
});
