const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSummaryMarkdown, collectAllIds, summarizeVendors } = require('../src/reporting');

function okPage(overrides = {}) {
  return {
    url: 'https://example.test/',
    status: 'ok',
    statusCode: 200,
    error: null,
    title: 'Example',
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
    ...overrides,
  };
}

function reportFromPages(pageReports, overrides = {}) {
  return {
    domain: 'https://example.test',
    scannedAt: '2026-04-28T00:00:00.000Z',
    config: {
      maxPages: 3,
      enableConsentClick: true,
    },
    scanUrls: pageReports.map(page => page.url),
    discovered_urls: pageReports.map((page, index) => ({
      url: page.url,
      rank: index + 1,
      scanned: true,
    })),
    pageReports,
    vendors: summarizeVendors(pageReports),
    ids: collectAllIds(pageReports),
    ...overrides,
  };
}

function assertCoreReportSections(markdown) {
  assert.match(markdown, /## Executive Summary/);
  assert.match(markdown, /## Scan Coverage/);
  assert.match(markdown, /## Evidence Type Guide/);
  assert.match(markdown, /## Detected Vendors by Category/);
  assert.match(markdown, /## Recommended Manual Review/);
  assert.match(markdown, /### What this scanner does not prove/);
  assert.match(markdown, /This report reflects browser-visible evidence from the scanned pages only/);
  assert.match(markdown, /It does not prove that a vendor is absent, fully installed, correctly configured, compliant, or accurately recording conversions\./);
}

test('Markdown report keeps all analyst-facing sections for detected vendors and IDs', () => {
  const pageReports = [
    okPage({
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
      pageGlobals: { globals: { dataLayer: { present: true } } },
      sourceSignals: {
        googleGlobals: { dataLayerPresent: true },
        htmlIds: [],
        inlineScriptIds: [{ type: 'GA4 Measurement ID', value: 'G-LOCAL123' }],
        noscriptIds: [],
      },
    }),
  ];

  const markdown = buildSummaryMarkdown(reportFromPages(pageReports));

  assertCoreReportSections(markdown);
  assert.match(markdown, /### Analytics/);
  assert.match(markdown, /- \*\*Google Analytics\*\*/);
  assert.match(markdown, /### Media \/ Advertising/);
  assert.match(markdown, /- \*\*Meta Pixel\*\*/);
  assert.match(markdown, /- \*\*Facebook Pixel ID:\*\* `123456789012345` - evidence type: Network evidence/);
  assert.match(markdown, /- \*\*GA4 Measurement ID:\*\* `G-LOCAL123` - evidence type: Script evidence, Source evidence/);
  assert.match(markdown, /Confirm whether consent state changes vendor firing; consent interaction was captured on 1 page\(s\) in this scan\./);
  assert.match(markdown, /Validate detected IDs against expected GTM containers, GA4 properties, media pixels, CMP settings, and other platform configurations\./);
});

test('Markdown report covers no vendors, no IDs, missing discovery metadata, and absent consent interaction', () => {
  const markdown = buildSummaryMarkdown(reportFromPages(
    [
      okPage({
        networkFindings: [],
        scriptFindings: [],
        sourceSignals: {
          googleGlobals: {},
          htmlIds: [],
          inlineScriptIds: [],
          noscriptIds: [],
        },
      }),
    ],
    {
      discovered_urls: undefined,
      config: {
        maxPages: 1,
        enableConsentClick: true,
      },
    }
  ));

  assertCoreReportSections(markdown);
  assert.match(markdown, /No supported vendors were detected by the current rules\./);
  assert.match(markdown, /No known IDs were extracted\./);
  assert.match(markdown, /Discovery metadata was not recorded for this report\./);
  assert.match(markdown, /Confirm important user paths manually because discovery metadata was not recorded for this report\./);
  assert.match(markdown, /Confirm whether consent state changes vendor firing; no consent interaction was captured in this scan\./);
  assert.doesNotMatch(markdown, /Validate detected IDs against expected/);
});

test('Markdown report covers failed pages, skipped discovered URLs, and source-only vendors', () => {
  const pageReports = [
    okPage({
      url: 'https://example.test/',
      sourceSignals: {
        googleGlobals: {},
        htmlIds: [],
        inlineScriptIds: [{ type: 'Facebook Pixel ID', value: '12345' }],
        noscriptIds: [],
      },
    }),
    okPage({
      url: 'https://example.test/broken',
      status: 'failed',
      statusCode: 500,
      error: 'timeout',
      title: '',
    }),
  ];

  const markdown = buildSummaryMarkdown(reportFromPages(pageReports, {
    discovered_urls: [
      { url: 'https://example.test/', rank: 1, scanned: true },
      { url: 'https://example.test/broken', rank: 2, scanned: true },
      { url: 'https://example.test/checkout', rank: 3, scanned: false },
    ],
  }));

  assertCoreReportSections(markdown);
  assert.match(markdown, /- Discovered but not scanned: 1/);
  assert.match(markdown, /### Failed or Partial Pages/);
  assert.match(markdown, /- https:\/\/example\.test\/broken/);
  assert.match(markdown, /Review important discovered URLs that were not scanned \(1 URL\(s\)\), especially if the configured maxPages limit excluded key paths\./);
  assert.match(markdown, /Review vendors seen only in source-level evidence without network or script evidence: Meta Pixel\./);
  assert.match(markdown, /Review failed, blocked, timeout, HTTP-error, or thin pages \(1 failed\/partial; 0 thin\/low-evidence\)\./);
});

test('Markdown report covers vendors detected without IDs', () => {
  const pageReports = [
    okPage({
      networkFindings: [
        {
          vendor: { name: 'Adobe Analytics / Experience Cloud', category: 'analytics' },
          ids: [],
        },
      ],
    }),
  ];

  const markdown = buildSummaryMarkdown(reportFromPages(pageReports));

  assertCoreReportSections(markdown);
  assert.match(markdown, /- \*\*Adobe Analytics \/ Experience Cloud\*\*/);
  assert.match(markdown, /  - IDs: none detected/);
  assert.match(markdown, /No known IDs were extracted\./);
  assert.doesNotMatch(markdown, /Validate detected IDs against expected/);
});
