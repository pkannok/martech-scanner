const test = require('node:test');
const assert = require('node:assert/strict');

const {
  collectRequestEvidenceFromRequest,
  mergeSourceEvidence,
} = require('../src/evidence');

function makePageReport() {
  return {
    title: '',
    networkFindings: [],
    scriptFindings: [],
    cookies: [],
    pageGlobals: {
      globals: {},
      ecommerceHints: {},
      cmsHints: {},
      authHints: {},
    },
    sourceSignals: {
      externalScripts: [],
      iframes: [],
      inlineScriptIds: [],
      htmlIds: [],
      noscriptIds: [],
      googleGlobals: {},
    },
  };
}

test('collectRequestEvidenceFromRequest captures scoped URL and post body IDs', () => {
  const request = {
    url: () => 'https://insight.adsrvr.org/track/cei?advertiser_id=abc123',
    postData: () => 'ttd_pid=body456',
    method: () => 'POST',
    resourceType: () => 'fetch',
  };

  const findings = collectRequestEvidenceFromRequest(request, {
    now: () => '2026-05-05T12:00:00.000Z',
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].vendor.name, 'The Trade Desk');
  assert.equal(findings[0].method, 'POST');
  assert.equal(findings[0].evidence.type, 'observed_firing');
  assert.equal(findings[0].confidence.level, 'high');
  assert.deepEqual(findings[0].ids, [
    { type: 'The Trade Desk Advertiser ID', value: 'abc123' },
    { type: 'The Trade Desk Advertiser ID', value: 'body456' },
  ]);
  assert.equal(findings[0].postDataPreview, 'ttd_pid=body456');
  assert.equal(findings[0].timestamp, '2026-05-05T12:00:00.000Z');
});

test('mergeSourceEvidence replaces baseline evidence and merges later evidence deterministically', () => {
  const report = makePageReport();

  mergeSourceEvidence(
    report,
    {
      title: 'Baseline',
      pageGlobals: {
        globals: {
          dataLayer: { present: false },
        },
      },
      sourceSignals: {
        externalScripts: ['https://www.googletagmanager.com/gtm.js?id=GTM-BASE'],
        iframes: ['https://www.googletagmanager.com/ns.html?id=GTM-BASE'],
        htmlIds: [{ type: 'GTM Container ID', value: 'GTM-BASE' }],
        inlineScriptIds: [{ type: 'GA4 Measurement ID', value: 'G-BASE123' }],
        noscriptIds: [],
        googleGlobals: { gtag: true },
      },
    },
    {
      replacePageGlobals: true,
      replaceSourceSignals: true,
    }
  );

  mergeSourceEvidence(report, {
    pageGlobals: {
      globals: {
        dataLayer: { present: true, length: 1 },
        digitalData: { present: false },
      },
    },
    sourceSignals: {
      externalScripts: ['https://example.com/new-script.js?id=12345'],
      iframes: ['https://example.com/new-frame?id=12345'],
      htmlIds: [
        { type: 'GTM Container ID', value: 'GTM-BASE' },
        { type: 'Facebook Pixel ID', value: '123456789012345' },
      ],
      inlineScriptIds: [{ type: 'GA4 Measurement ID', value: 'G-BASE123' }],
      noscriptIds: [{ type: 'Pinterest Tag ID', value: '2613646378106' }],
      googleGlobals: { dataLayerPresent: true },
    },
    scriptFindings: [
      {
        src: 'https://connect.facebook.net/en_US/fbevents.js',
        detectedVendors: [{ name: 'Meta Pixel', category: 'media_pixel' }],
      },
      {
        src: 'https://connect.facebook.net/en_US/fbevents.js',
        detectedVendors: [{ name: 'Meta Pixel', category: 'media_pixel' }],
      },
    ],
    cookies: [
      { name: 'session', domain: 'example.com', path: '/' },
      { name: 'session', domain: 'example.com', path: '/' },
    ],
    networkFindings: [
      {
        vendor: { name: 'Meta Pixel', category: 'media_pixel' },
        method: 'GET',
        url: 'https://www.facebook.com/tr?id=123456789012345',
      },
      {
        vendor: { name: 'Meta Pixel', category: 'media_pixel' },
        method: 'GET',
        url: 'https://www.facebook.com/tr?id=123456789012345',
      },
    ],
  });

  assert.equal(report.title, 'Baseline');
  assert.deepEqual(report.pageGlobals.globals.dataLayer, { present: true, length: 1 });
  assert.equal(report.pageGlobals.globals.digitalData, undefined);
  assert.deepEqual(report.sourceSignals.externalScripts, [
    'https://www.googletagmanager.com/gtm.js?id=GTM-BASE',
  ]);
  assert.deepEqual(report.sourceSignals.iframes, [
    'https://www.googletagmanager.com/ns.html?id=GTM-BASE',
  ]);
  assert.deepEqual(report.sourceSignals.htmlIds, [
    { type: 'GTM Container ID', value: 'GTM-BASE' },
    { type: 'Facebook Pixel ID', value: '123456789012345' },
  ]);
  assert.deepEqual(report.sourceSignals.inlineScriptIds, [
    { type: 'GA4 Measurement ID', value: 'G-BASE123' },
  ]);
  assert.deepEqual(report.sourceSignals.noscriptIds, [
    { type: 'Pinterest Tag ID', value: '2613646378106' },
  ]);
  assert.deepEqual(report.sourceSignals.googleGlobals, {
    gtag: true,
    dataLayerPresent: true,
  });
  assert.equal(report.scriptFindings.length, 1);
  assert.equal(report.cookies.length, 1);
  assert.equal(report.networkFindings.length, 1);
});
