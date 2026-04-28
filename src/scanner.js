#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const {
  DEFAULT_TIMEOUT,
  DEFAULT_OUT_DIR,
  DEFAULT_MAX_PAGES,
} = require('./config');

const {
  parseArgs,
  normalizeDomain,
  ensureDir,
  nowIso,
  dedupeBy,
  slugifyHostname,
  sleep,
} = require('./utils');

const {
  detectVendorFromUrl,
  extractIds,
  extractIdsFromTextBlock,
} = require('./detectors');

const { discoverPages } = require('./discovery');

const {
  collectThirdPartyScripts,
  inspectPageGlobals,
  inspectPageSourceSignals,
  collectCookies,
} = require('./inspectors');

const {
  createScanContext,
  safeGoto,
  clickConsentButtons,
  stimulatePageActivity,
} = require('./browser');

const {
  summarizeVendors,
  collectAllIds,
  buildSummaryMarkdown,
} = require('./reporting');

function pageArtifactSlug(urlString) {
  const url = new URL(urlString);
  const raw = [url.hostname, url.pathname || 'root', url.hash || '']
    .join('_')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  return raw || 'page';
}

function evidenceScore(report) {
  const sourceIdCount =
    (report.sourceSignals?.htmlIds?.length || 0) +
    (report.sourceSignals?.inlineScriptIds?.length || 0) +
    (report.sourceSignals?.noscriptIds?.length || 0);

  const googleSignalCount = Object.values(report.sourceSignals?.googleGlobals || {}).filter(Boolean).length;
  const globalSignalCount = Object.values(report.pageGlobals?.globals || {}).filter(info => info?.present).length;

  return (
    (report.networkFindings?.length || 0) * 10 +
    (report.scriptFindings?.length || 0) * 5 +
    sourceIdCount * 2 +
    googleSignalCount +
    globalSignalCount
  );
}

function shouldRetryThinPage(report) {
  if (report.status !== 'ok') return false;
  if (report.statusCode !== null && report.statusCode >= 400) return false;
  if ((report.networkFindings?.length || 0) > 0) return false;
  if ((report.scriptFindings?.length || 0) > 0) return false;
  return true;
}

async function runScanPass(browser, baseUrl, targetUrl, timeout, enableConsentClick, options = {}) {
  const context = await createScanContext(browser, {
    recordHarPath: options.harPath,
  });
  const page = await context.newPage();
  const rawNetworkEvents = [];

  if (options.tracePath) {
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
  }

  page.on('request', request => {
    const url = request.url();
    const vendors = detectVendorFromUrl(url);
    if (!vendors.length) return;

    const postData = request.postData() || '';
    const combinedIds = dedupeBy(
      [
        ...extractIds(url),
        ...extractIdsFromTextBlock(postData),
      ],
      x => `${x.type}|${x.value}`
    );

    for (const vendor of vendors) {
      rawNetworkEvents.push({
        vendor,
        url,
        method: request.method(),
        resourceType: request.resourceType(),
        ids: combinedIds,
        postDataPreview: postData.slice(0, 2000),
        timestamp: nowIso(),
      });
    }
  });

  const pageReport = {
    url: targetUrl,
    status: 'ok',
    statusCode: null,
    error: null,
    title: '',
    consentClicks: [],
    diagnostics: {
      retriedThinPage: options.retryMode === 'thin-page',
      retryReason: options.retryReason || null,
      retryMode: options.retryMode || null,
      tracePath: options.tracePath || null,
      harPath: options.harPath || null,
    },
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

  try {
    if (typeof options.prepareContext === 'function') {
      await options.prepareContext(context, page);
    }

    const visit = await safeGoto(page, targetUrl, timeout);
    if (!visit.ok) {
      pageReport.status = 'failed';
      pageReport.error = visit.error;
      await context.close();
      return pageReport;
    }

    pageReport.statusCode = visit.statusCode;

    // Baseline page globals
    const baselineGlobals = await inspectPageGlobals(page);
    pageReport.title = baselineGlobals.title || '';
    pageReport.pageGlobals = baselineGlobals;

    // Extract IDs from captured global previews
    const globalDerivedIds = [];
    for (const key of [
      'dataLayer',
      'adobeDataLayer',
      'digitalData',
      'utag_data',
      '__NEXT_DATA__',
      '__INITIAL_STATE__',
    ]) {
      const preview = pageReport.pageGlobals?.globals?.[key]?.preview;
      if (preview) {
        globalDerivedIds.push(...extractIdsFromTextBlock(preview));
      }
    }

    // Source-level inspection
    const sourceSignals = await inspectPageSourceSignals(page);

    pageReport.sourceSignals = {
      externalScripts: sourceSignals.externalScripts || [],
      iframes: sourceSignals.iframes || [],
      inlineScriptIds: [],
      htmlIds: [],
      noscriptIds: [],
      googleGlobals: sourceSignals.globals || {},
    };

    // IDs from HTML
    pageReport.sourceSignals.htmlIds = dedupeBy(
      [
        ...extractIdsFromTextBlock(sourceSignals.htmlSnippet || ''),
        ...globalDerivedIds,
      ],
      x => `${x.type}|${x.value}`
    );

    // IDs from inline scripts
    for (const scriptText of sourceSignals.inlineScripts || []) {
      pageReport.sourceSignals.inlineScriptIds.push(
        ...extractIdsFromTextBlock(scriptText)
      );
    }

    // IDs from noscript blocks
    for (const text of sourceSignals.noscriptText || []) {
      pageReport.sourceSignals.noscriptIds.push(
        ...extractIdsFromTextBlock(text)
      );
    }

    // Also inspect iframe and external script URLs for IDs
    for (const iframeSrc of sourceSignals.iframes || []) {
      pageReport.sourceSignals.htmlIds.push(
        ...extractIdsFromTextBlock(iframeSrc)
      );
    }

    for (const extSrc of sourceSignals.externalScripts || []) {
      pageReport.sourceSignals.htmlIds.push(
        ...extractIdsFromTextBlock(extSrc)
      );
    }

    pageReport.sourceSignals.inlineScriptIds = dedupeBy(
      pageReport.sourceSignals.inlineScriptIds,
      x => `${x.type}|${x.value}`
    );

    pageReport.sourceSignals.htmlIds = dedupeBy(
      pageReport.sourceSignals.htmlIds,
      x => `${x.type}|${x.value}`
    );

    pageReport.sourceSignals.noscriptIds = dedupeBy(
      pageReport.sourceSignals.noscriptIds,
      x => `${x.type}|${x.value}`
    );

    // Consent interaction and post-consent re-check
    if (enableConsentClick) {
      const consentClicks = await clickConsentButtons(page);
      pageReport.consentClicks = consentClicks;

      if (consentClicks.length) {
        await sleep(3000);

        const postConsentGlobals = await inspectPageGlobals(page);
        const postConsentSourceSignals = await inspectPageSourceSignals(page);

        // Merge improved globals if they appear after consent
        for (const [key, value] of Object.entries(postConsentGlobals.globals || {})) {
          const baselineValue = pageReport.pageGlobals.globals[key];

          if (!baselineValue?.present && value?.present) {
            pageReport.pageGlobals.globals[key] = value;
          }
        }

        // Merge google/global signals
        pageReport.sourceSignals.googleGlobals = {
          ...pageReport.sourceSignals.googleGlobals,
          ...(postConsentSourceSignals.globals || {}),
        };

        // Merge HTML-derived IDs
        pageReport.sourceSignals.htmlIds = dedupeBy(
          [
            ...pageReport.sourceSignals.htmlIds,
            ...extractIdsFromTextBlock(postConsentSourceSignals.htmlSnippet || ''),
          ],
          x => `${x.type}|${x.value}`
        );

        // Merge inline script IDs
        const moreInlineIds = [];
        for (const scriptText of postConsentSourceSignals.inlineScripts || []) {
          moreInlineIds.push(...extractIdsFromTextBlock(scriptText));
        }

        pageReport.sourceSignals.inlineScriptIds = dedupeBy(
          [...pageReport.sourceSignals.inlineScriptIds, ...moreInlineIds],
          x => `${x.type}|${x.value}`
        );

        // Merge noscript IDs
        const moreNoscriptIds = [];
        for (const text of postConsentSourceSignals.noscriptText || []) {
          moreNoscriptIds.push(...extractIdsFromTextBlock(text));
        }

        pageReport.sourceSignals.noscriptIds = dedupeBy(
          [...pageReport.sourceSignals.noscriptIds, ...moreNoscriptIds],
          x => `${x.type}|${x.value}`
        );

        // Merge external script and iframe derived IDs
        const moreHtmlIds = [];
        for (const iframeSrc of postConsentSourceSignals.iframes || []) {
          moreHtmlIds.push(...extractIdsFromTextBlock(iframeSrc));
        }
        for (const extSrc of postConsentSourceSignals.externalScripts || []) {
          moreHtmlIds.push(...extractIdsFromTextBlock(extSrc));
        }

        pageReport.sourceSignals.htmlIds = dedupeBy(
          [...pageReport.sourceSignals.htmlIds, ...moreHtmlIds],
          x => `${x.type}|${x.value}`
        );

        // Also extract IDs from newly visible global previews
        const postConsentGlobalDerivedIds = [];
        for (const key of [
          'dataLayer',
          'adobeDataLayer',
          'digitalData',
          'utag_data',
          '__NEXT_DATA__',
          '__INITIAL_STATE__',
        ]) {
          const preview = postConsentGlobals?.globals?.[key]?.preview;
          if (preview) {
            postConsentGlobalDerivedIds.push(...extractIdsFromTextBlock(preview));
          }
        }

        pageReport.sourceSignals.htmlIds = dedupeBy(
          [...pageReport.sourceSignals.htmlIds, ...postConsentGlobalDerivedIds],
          x => `${x.type}|${x.value}`
        );
      }
    }

    // Stimulate the page so deferred/lazy page-view tags have a chance to fire.
    await stimulatePageActivity(page, { rich: options.richInteractions === true });

    const postActivityGlobals = await inspectPageGlobals(page);
    const postActivitySourceSignals = await inspectPageSourceSignals(page);

    for (const [key, value] of Object.entries(postActivityGlobals.globals || {})) {
      const baselineValue = pageReport.pageGlobals.globals[key];

      if (!baselineValue?.present && value?.present) {
        pageReport.pageGlobals.globals[key] = value;
      }
    }

    pageReport.sourceSignals.googleGlobals = {
      ...pageReport.sourceSignals.googleGlobals,
      ...(postActivitySourceSignals.globals || {}),
    };

    pageReport.sourceSignals.htmlIds = dedupeBy(
      [
        ...pageReport.sourceSignals.htmlIds,
        ...extractIdsFromTextBlock(postActivitySourceSignals.htmlSnippet || ''),
      ],
      x => `${x.type}|${x.value}`
    );

    const postActivityInlineIds = [];
    for (const scriptText of postActivitySourceSignals.inlineScripts || []) {
      postActivityInlineIds.push(...extractIdsFromTextBlock(scriptText));
    }

    pageReport.sourceSignals.inlineScriptIds = dedupeBy(
      [...pageReport.sourceSignals.inlineScriptIds, ...postActivityInlineIds],
      x => `${x.type}|${x.value}`
    );

    const postActivityNoscriptIds = [];
    for (const text of postActivitySourceSignals.noscriptText || []) {
      postActivityNoscriptIds.push(...extractIdsFromTextBlock(text));
    }

    pageReport.sourceSignals.noscriptIds = dedupeBy(
      [...pageReport.sourceSignals.noscriptIds, ...postActivityNoscriptIds],
      x => `${x.type}|${x.value}`
    );

    const postActivityHtmlIds = [];
    for (const iframeSrc of postActivitySourceSignals.iframes || []) {
      postActivityHtmlIds.push(...extractIdsFromTextBlock(iframeSrc));
    }
    for (const extSrc of postActivitySourceSignals.externalScripts || []) {
      postActivityHtmlIds.push(...extractIdsFromTextBlock(extSrc));
    }

    for (const key of [
      'dataLayer',
      'adobeDataLayer',
      'digitalData',
      'utag_data',
      '__NEXT_DATA__',
      '__INITIAL_STATE__',
    ]) {
      const preview = postActivityGlobals?.globals?.[key]?.preview;
      if (preview) {
        postActivityHtmlIds.push(...extractIdsFromTextBlock(preview));
      }
    }

    pageReport.sourceSignals.htmlIds = dedupeBy(
      [...pageReport.sourceSignals.htmlIds, ...postActivityHtmlIds],
      x => `${x.type}|${x.value}`
    );

    // Third-party scripts
    const scripts = await collectThirdPartyScripts(page, baseUrl);
	pageReport.scriptFindings = dedupeBy(
		scripts
			.filter(script => script.thirdParty)
			.map(script => {
				const detectedVendors = detectVendorFromUrl(script.src);
				const ids = extractIds(script.src);
				
				return {
					src: script.src,
					detectedVendors,
					ids,
				};
			})
			.filter(item =>
				item.detectedVendors.length > 0 ||
				item.ids.length > 0 ||
				/gtag\/js|gtm\.js|google-analytics|doubleclick|googleadservices|googlesyndication/i.test(item.src)
			),
		x => x.src
	);

    // Cookies
    pageReport.cookies = await collectCookies(context, page.url());

    // Network findings
    pageReport.networkFindings = dedupeBy(
      rawNetworkEvents.map(event => ({
        vendor: event.vendor,
        url: event.url,
        method: event.method,
        resourceType: event.resourceType,
        ids: event.ids,
        postDataPreview: event.postDataPreview,
        timestamp: event.timestamp,
      })),
      x => `${x.vendor.name}|${x.method}|${x.url}`
    );

    if (options.tracePath) {
      await context.tracing.stop({ path: options.tracePath }).catch(() => {});
    }

    await context.close();
    return pageReport;
  } catch (error) {
    pageReport.status = 'failed';
    pageReport.error = error.message;

    if (options.tracePath) {
      await context.tracing.stop({ path: options.tracePath }).catch(() => {});
    }

    await context.close();
    return pageReport;
  }
}

async function scanSinglePage(browser, baseUrl, targetUrl, timeout, enableConsentClick, artifactsDir) {
  const initialReport = await runScanPass(
    browser,
    baseUrl,
    targetUrl,
    timeout,
    enableConsentClick
  );

  if (!shouldRetryThinPage(initialReport)) {
    return initialReport;
  }

  const artifactSlug = pageArtifactSlug(targetUrl);
  const retryReport = await runScanPass(
    browser,
    baseUrl,
    targetUrl,
    timeout,
    enableConsentClick,
    {
      richInteractions: true,
      retryMode: 'thin-page',
      retryReason: 'Source IDs were present but no network or third-party script findings were captured.',
      tracePath: path.join(artifactsDir, `${artifactSlug}_retry_trace.zip`),
      harPath: path.join(artifactsDir, `${artifactSlug}_retry.har`),
    }
  );

  if (evidenceScore(retryReport) >= evidenceScore(initialReport)) {
    return retryReport;
  }

  initialReport.diagnostics = {
    ...(initialReport.diagnostics || {}),
    retriedThinPage: true,
    retryMode: 'thin-page',
    retryReason: 'Source IDs were present but no network or third-party script findings were captured.',
    tracePath: retryReport.diagnostics?.tracePath || null,
    harPath: retryReport.diagnostics?.harPath || null,
  };

  return initialReport;
}

async function main(argv = process.argv) {
  const args = parseArgs(argv);
  const domain = normalizeDomain(args.domain);
  const headless = String(args.headless || 'true').toLowerCase() !== 'false';
  const timeout = Number(args.timeout || DEFAULT_TIMEOUT);
  const maxPages = Number(args.maxPages || DEFAULT_MAX_PAGES);
  const outDir = args.out || DEFAULT_OUT_DIR;
  const enableConsentClick = String(args.enableConsentClick || 'true').toLowerCase() !== 'false';

  ensureDir(outDir);
  const artifactsDir = path.join(outDir, 'artifacts');
  ensureDir(artifactsDir);

  const pageReports = [];
  let scanUrls = [];
  const browser = await chromium.launch({ headless });

  try {
    const discoveredUrls = await discoverPages(browser, domain, timeout, maxPages);
    scanUrls = dedupeBy([domain, ...discoveredUrls], x => x).slice(0, maxPages);

    for (const url of scanUrls) {
      const report = await scanSinglePage(browser, domain, url, timeout, enableConsentClick, artifactsDir);
      pageReports.push(report);
    }
  } finally {
    await browser.close();
  }

  const finalReport = {
    domain,
    scannedAt: nowIso(),
    config: {
      headless,
      timeout,
      maxPages,
      enableConsentClick,
    },
    scanUrls,
    pageReports,
    vendors: summarizeVendors(pageReports),
    ids: collectAllIds(pageReports),
  };

  const baseName = slugifyHostname(domain);
  const jsonPath = path.join(outDir, `${baseName}_results_v2_3.json`);
  const mdPath = path.join(outDir, `${baseName}_summary_v2_3.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(finalReport, null, 2), 'utf8');
  fs.writeFileSync(mdPath, buildSummaryMarkdown(finalReport), 'utf8');

  return {
    finalReport,
    jsonPath,
    mdPath,
  };
}

if (require.main === module) {
  main().then(({ jsonPath, mdPath }) => {
    console.log('Scan complete.');
    console.log(`JSON: ${jsonPath}`);
    console.log(`Summary: ${mdPath}`);
  }).catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = {
  pageArtifactSlug,
  evidenceScore,
  shouldRetryThinPage,
  runScanPass,
  scanSinglePage,
  main,
};
