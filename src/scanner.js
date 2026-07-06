#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const {
  ensureDir,
  nowIso,
  dedupeBy,
  canonicalPageKey,
  slugifyUrl,
  sleep,
} = require('./utils');
const { CliError, getHelpText, parseCliArgs } = require('./cli');

const {
  createRequestEvidenceRecorder,
  collectSourceEvidence,
  mergeSourceEvidence,
} = require('./evidence');

const { discoverPages, prioritizeScanUrls } = require('./discovery');
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

function logProgress(logger, message) {
  if (!logger || typeof logger.log !== 'function') return;
  logger.log(`[${nowIso()}] ${message}`);
}

function shouldRetryThinPage(report) {
  if (report.status !== 'ok') return false;
  if (report.statusCode !== null && report.statusCode >= 400) return false;
  if ((report.networkFindings?.length || 0) > 0) return false;
  if ((report.scriptFindings?.length || 0) > 0) return false;
  return true;
}

function buildDiscoveredUrlReport(discoveredUrls, scanUrls) {
  const scannedKeys = new Set(scanUrls.map(canonicalPageKey));

  return discoveredUrls.map((url, index) => ({
    url,
    rank: index + 1,
    scanned: scannedKeys.has(canonicalPageKey(url)),
  }));
}

function dateStampFromIso(isoString) {
  return String(isoString || '').slice(0, 10).replace(/-/g, '');
}

function buildReportPaths(outDir, normalizedInputUrl, scannedAt, existsSync = fs.existsSync) {
  const baseName = slugifyUrl(normalizedInputUrl);
  const dateStamp = dateStampFromIso(scannedAt);
  let counter = 0;

  while (true) {
    const suffix = counter === 0 ? '' : `_${String(counter).padStart(2, '0')}`;
    const jsonPath = path.join(outDir, `${baseName}_results_${dateStamp}${suffix}.json`);
    const mdPath = path.join(outDir, `${baseName}_summary_${dateStamp}${suffix}.md`);

    if (!existsSync(jsonPath) && !existsSync(mdPath)) {
      return { jsonPath, mdPath };
    }

    counter += 1;
  }
}

async function runScanPass(browser, baseUrl, targetUrl, timeout, enableConsentClick, options = {}) {
  const context = await createScanContext(browser, {
    recordHarPath: options.harPath,
  });
  const page = await context.newPage();
  const requestRecorder = createRequestEvidenceRecorder(page);

  if (options.tracePath) {
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
  }

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
      requestRecorder.dispose();
      await context.close();
      return pageReport;
    }

    pageReport.statusCode = visit.statusCode;

    const baselineEvidence = await collectSourceEvidence(page, context, {
      baseUrl,
      phase: 'baseline',
    });
    mergeSourceEvidence(pageReport, baselineEvidence, {
      replacePageGlobals: true,
      replaceSourceSignals: true,
    });

    if (enableConsentClick) {
      const consentClicks = await clickConsentButtons(page);
      pageReport.consentClicks = consentClicks;

      if (consentClicks.length) {
        await sleep(3000);

        const postConsentEvidence = await collectSourceEvidence(page, context, {
          baseUrl,
          phase: 'post-consent',
        });
        mergeSourceEvidence(pageReport, postConsentEvidence);
      }
    }

    await stimulatePageActivity(page, { rich: options.richInteractions === true });

    const postActivityEvidence = await collectSourceEvidence(page, context, {
      baseUrl,
      phase: 'post-activity',
      includeScripts: true,
      includeCookies: true,
      includeNetwork: true,
      requestEvents: requestRecorder.events,
    });
    mergeSourceEvidence(pageReport, postActivityEvidence);

    if (options.tracePath) {
      await context.tracing.stop({ path: options.tracePath }).catch(() => {});
    }

    requestRecorder.dispose();
    await context.close();
    return pageReport;
  } catch (error) {
    pageReport.status = 'failed';
    pageReport.error = error.message;

    if (options.tracePath) {
      await context.tracing.stop({ path: options.tracePath }).catch(() => {});
    }

    requestRecorder.dispose();
    await context.close();
    return pageReport;
  }
}

async function scanSinglePage(browser, baseUrl, targetUrl, timeout, enableConsentClick, artifactsDir, options = {}) {
  const logger = options.logger || null;
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
  logProgress(logger, `Retrying thin page with richer interactions: ${targetUrl}`);
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

async function main(argv = process.argv, options = {}) {
  const logger = options.logger === false ? null : options.logger || console;
  const args = parseCliArgs(argv);
  if (args.help) {
    if (logger) logger.log(getHelpText());
    return { help: true };
  }
  const { domain, headless, timeout, maxPages, outDir, enableConsentClick } = args;
  const { chromium } = require('playwright');

  ensureDir(outDir);
  const artifactsDir = path.join(outDir, 'artifacts');
  ensureDir(artifactsDir);

  const pageReports = [];
  let scanUrls = [];
  let discoveredUrls = [];
  let discoveredUrlReport = [];

  logProgress(logger, `Starting scan for ${domain}`);
  logProgress(logger, `Config: headless=${headless}, timeout=${timeout}ms, maxPages=${maxPages}, consentClick=${enableConsentClick}`);
  logProgress(logger, 'Launching Chromium...');
  const browser = await chromium.launch({ headless });

  try {
    logProgress(logger, 'Discovering pages...');
    discoveredUrls = await discoverPages(browser, domain, timeout);
    const scanCandidateUrls = dedupeBy([domain, ...discoveredUrls], canonicalPageKey);
    scanUrls = prioritizeScanUrls(domain, discoveredUrls, maxPages);
    const duplicateCount = Math.max(0, discoveredUrls.length + 1 - scanCandidateUrls.length);
    discoveredUrlReport = buildDiscoveredUrlReport(discoveredUrls, scanUrls);
    logProgress(logger, `Discovered ${discoveredUrls.length} candidate URL(s); scanning ${scanUrls.length} unique page(s).`);
    if (duplicateCount) {
      logProgress(logger, `Skipped ${duplicateCount} duplicate URL variant(s).`);
    }

    for (const [index, url] of scanUrls.entries()) {
      logProgress(logger, `Scanning page ${index + 1}/${scanUrls.length}: ${url}`);
      const report = await scanSinglePage(browser, domain, url, timeout, enableConsentClick, artifactsDir, { logger });
      pageReports.push(report);

      const pageVendorCount = summarizeVendors([report]).length;
      const pageIdCount = collectAllIds([report]).length;
      const httpStatus = report.statusCode === null || report.statusCode === undefined ? 'n/a' : report.statusCode;
      const retryNote = report.diagnostics?.retriedThinPage ? ', retried=true' : '';
      const errorNote = report.error ? `, error=${report.error.slice(0, 140)}` : '';
      logProgress(
        logger,
        `Finished page ${index + 1}/${scanUrls.length}: status=${report.status}, http=${httpStatus}, vendors=${pageVendorCount}, ids=${pageIdCount}, network=${report.networkFindings.length}, scripts=${report.scriptFindings.length}${retryNote}${errorNote}`
      );
    }
  } finally {
    await browser.close();
    logProgress(logger, 'Closed Chromium.');
  }

  const scannedAt = nowIso();
  const finalReport = {
    domain,
    scannedAt,
    config: {
      headless,
      timeout,
      maxPages,
      enableConsentClick,
    },
    scanUrls,
    discovered_urls: discoveredUrlReport,
    pageReports,
    vendors: summarizeVendors(pageReports),
    ids: collectAllIds(pageReports),
  };

  const { jsonPath, mdPath } = buildReportPaths(outDir, domain, scannedAt);

  logProgress(logger, 'Writing report files...');
  fs.writeFileSync(jsonPath, JSON.stringify(finalReport, null, 2), 'utf8');
  fs.writeFileSync(mdPath, buildSummaryMarkdown(finalReport), 'utf8');
  logProgress(logger, `Wrote JSON report: ${jsonPath}`);
  logProgress(logger, `Wrote Markdown summary: ${mdPath}`);

  return {
    finalReport,
    jsonPath,
    mdPath,
  };
}

if (require.main === module) {
  main().then(result => {
    if (result.help) return;
    const { jsonPath, mdPath } = result;
    console.log('Scan complete.');
    console.log(`JSON: ${jsonPath}`);
    console.log(`Summary: ${mdPath}`);
  }).catch(error => {
    if (error instanceof CliError) {
      console.error(`Input error: ${error.message}`);
    } else {
      console.error('Fatal error:', error.message);
    }
    process.exit(1);
  });
}

module.exports = {
  pageArtifactSlug,
  evidenceScore,
  shouldRetryThinPage,
  buildDiscoveredUrlReport,
  dateStampFromIso,
  buildReportPaths,
  runScanPass,
  scanSinglePage,
  main,
};
