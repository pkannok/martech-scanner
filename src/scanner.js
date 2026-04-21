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
} = require('./browser');

const {
  summarizeVendors,
  collectAllIds,
  buildSummaryMarkdown,
} = require('./reporting');

async function scanSinglePage(browser, baseUrl, targetUrl, timeout, enableConsentClick) {
  const context = await createScanContext(browser);
  const page = await context.newPage();
  const rawNetworkEvents = [];

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

    await context.close();
    return pageReport;
  } catch (error) {
    pageReport.status = 'failed';
    pageReport.error = error.message;
    await context.close();
    return pageReport;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const domain = normalizeDomain(args.domain);
  const headless = String(args.headless || 'true').toLowerCase() !== 'false';
  const timeout = Number(args.timeout || DEFAULT_TIMEOUT);
  const maxPages = Number(args.maxPages || DEFAULT_MAX_PAGES);
  const outDir = args.out || DEFAULT_OUT_DIR;
  const enableConsentClick = String(args.enableConsentClick || 'true').toLowerCase() !== 'false';

  ensureDir(outDir);

  const browser = await chromium.launch({ headless });

  const discoveredUrls = await discoverPages(browser, domain, timeout, maxPages);
  const scanUrls = dedupeBy([domain, ...discoveredUrls], x => x).slice(0, maxPages);

  const pageReports = [];
  for (const url of scanUrls) {
    const report = await scanSinglePage(browser, domain, url, timeout, enableConsentClick);
    pageReports.push(report);
  }

  await browser.close();

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

  console.log('Scan complete.');
  console.log(`JSON: ${jsonPath}`);
  console.log(`Summary: ${mdPath}`);
}

main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});