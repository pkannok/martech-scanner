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
const { CliError, getHelpText, getVersionText, parseCliArgs } = require('./cli');
const { SCANNER_VERSION, REPORT_TEMPLATE_VERSION } = require('./version');
const { createProgressEmitter } = require('./progress');

const {
  createRequestEvidenceRecorder,
  collectSourceEvidence,
  mergeSourceEvidence,
} = require('./evidence');

const { discoverPages, prioritizeScanUrls } = require('./discovery');
const {
  createScanContext,
  safeGoto,
  stimulatePageActivity,
} = require('./browser');

const {
  summarizeVendors,
  collectAllIds,
  buildSummaryMarkdown,
} = require('./reporting');
const { DEFAULT_DELAYED_OBSERVATION_MS } = require('./config');
const { acceptConsent } = require('./consent');
const { observeSpaRoute } = require('./spa');
const { performSafeInteraction } = require('./interaction');

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
      consent: { detected: false, attempted: false, success: false },
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
  let activeRoute = null;

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
      includeScripts: true,
      includeCookies: true,
      includeNetwork: true,
      requestEvents: requestRecorder.events,
    });
    mergeSourceEvidence(pageReport, baselineEvidence, {
      replacePageGlobals: true,
      replaceSourceSignals: true,
    });
    progressObservation(options.progress, { phase: 'baseline', url: targetUrl });

    await stimulatePageActivity(page);

    const delayedObservationMs = Number.isFinite(options.delayedObservationMs)
      ? Math.max(0, options.delayedObservationMs)
      : DEFAULT_DELAYED_OBSERVATION_MS;
    progressObservation(options.progress, { phase: 'delayed', url: targetUrl, observing: true, durationMs: delayedObservationMs });
    await sleep(delayedObservationMs);

    const postActivityEvidence = await collectSourceEvidence(page, context, {
      baseUrl,
      phase: 'delayed',
      includeScripts: true,
      includeCookies: true,
      includeNetwork: true,
      requestEvents: requestRecorder.events,
    });
    mergeSourceEvidence(pageReport, postActivityEvidence);
    progressObservation(options.progress, { phase: 'delayed', url: targetUrl, observing: false, durationMs: delayedObservationMs });

    if (enableConsentClick) {
      const consent = await acceptConsent(page, { clickTimeoutMs: options.consentClickTimeoutMs });
      pageReport.diagnostics.consent = consent;
      pageReport.consentClicks = consent.success ? [consent.controlText] : [];
      if (consent.detected) progressObservation(options.progress, { phase: 'consent', url: targetUrl, action: consent.success ? 'accepted' : 'failed', consent });
      if (consent.success) {
        const postConsentMs = Number.isFinite(options.consentObservationMs) ? Math.max(0, options.consentObservationMs) : delayedObservationMs;
        progressObservation(options.progress, { phase: 'consent-accepted', url: targetUrl, observing: true, durationMs: postConsentMs });
        await sleep(postConsentMs);
        const postConsentEvidence = await collectSourceEvidence(page, context, {
          baseUrl,
          phase: 'consent-accepted',
          includeScripts: true,
          includeCookies: true,
          includeNetwork: true,
          requestEvents: requestRecorder.events,
        });
        mergeSourceEvidence(pageReport, postConsentEvidence);
        progressObservation(options.progress, { phase: 'consent-accepted', url: targetUrl, observing: false, durationMs: postConsentMs });
      }
    }

    if (options.enableSpaObservation !== false) {
      const spa = await observeSpaRoute(page, {
        clickTimeoutMs: options.spaClickTimeoutMs,
        routeTimeoutMs: options.spaRouteTimeoutMs,
      });
      pageReport.diagnostics.spa = spa;
      if (spa.success) {
        activeRoute = { routeFrom: spa.routeFrom, routeTo: spa.routeTo };
        const postRouteMs = Number.isFinite(options.spaObservationMs) ? Math.max(0, options.spaObservationMs) : delayedObservationMs;
        progressObservation(options.progress, { phase: 'spa-navigation', url: targetUrl, routeFrom: spa.routeFrom, routeTo: spa.routeTo, observing: true, durationMs: postRouteMs });
        await sleep(postRouteMs);
        const routeEvidence = await collectSourceEvidence(page, context, {
          baseUrl,
          phase: 'spa-navigation',
          routeFrom: spa.routeFrom,
          routeTo: spa.routeTo,
          includeScripts: true,
          includeCookies: true,
          includeNetwork: true,
          requestEvents: requestRecorder.events,
        });
        routeEvidence.routeFrom = spa.routeFrom;
        routeEvidence.routeTo = spa.routeTo;
        mergeSourceEvidence(pageReport, routeEvidence);
        progressObservation(options.progress, { phase: 'spa-navigation', url: targetUrl, routeFrom: spa.routeFrom, routeTo: spa.routeTo, observing: false, durationMs: postRouteMs });
      }
    }

    if (options.enableInteractionObservation !== false) {
      const interaction = await performSafeInteraction(page, { clickTimeoutMs: options.interactionClickTimeoutMs });
      pageReport.diagnostics.interaction = interaction;
      if (interaction.success) {
        const postInteractionMs = Number.isFinite(options.interactionObservationMs) ? Math.max(0, options.interactionObservationMs) : delayedObservationMs;
        progressObservation(options.progress, { phase: 'interaction', url: targetUrl, interactionType: interaction.type, interactionLabel: interaction.label, observing: true, durationMs: postInteractionMs });
        await sleep(postInteractionMs);
        const interactionEvidence = await collectSourceEvidence(page, context, {
          baseUrl,
          phase: 'interaction',
          ...(activeRoute || {}),
          includeScripts: true,
          includeCookies: true,
          includeNetwork: true,
          requestEvents: requestRecorder.events,
        });
        interactionEvidence.interactionType = interaction.type;
        interactionEvidence.interactionLabel = interaction.label;
        if (activeRoute) {
          interactionEvidence.routeFrom = activeRoute.routeFrom;
          interactionEvidence.routeTo = activeRoute.routeTo;
        }
        mergeSourceEvidence(pageReport, interactionEvidence);
        progressObservation(options.progress, { phase: 'interaction', url: targetUrl, interactionType: interaction.type, interactionLabel: interaction.label, observing: false, durationMs: postInteractionMs });
      }
    }

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

function progressObservation(progress, event) {
  if (typeof progress === 'function') progress({ type: 'page:observation', ...event });
}

async function scanSinglePage(browser, baseUrl, targetUrl, timeout, enableConsentClick, artifactsDir, options = {}) {
  const progress = options.progress || (() => {});
  const initialReport = await runScanPass(
    browser,
    baseUrl,
    targetUrl,
    timeout,
    enableConsentClick,
    options
  );

  if (!shouldRetryThinPage(initialReport)) {
    return initialReport;
  }

  const artifactSlug = pageArtifactSlug(targetUrl);
  progress({
    type: 'page:retry',
    url: targetUrl,
    reason: 'Source IDs were present but no network or third-party script findings were captured.',
  });
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
      delayedObservationMs: options.delayedObservationMs,
      progress,
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
  const progress = createProgressEmitter({ logger, onProgress: options.onProgress });
  const args = parseCliArgs(argv);
  if (args.help) {
    if (logger) logger.log(getHelpText());
    return { help: true };
  }
  if (args.version) {
    if (logger) logger.log(getVersionText());
    return { version: true };
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

  progress({
    type: 'scan:start',
    domain,
    config: { headless, timeout, maxPages, enableConsentClick },
  });
  progress({
    type: 'scan:config',
    message: `Config: headless=${headless}, timeout=${timeout}ms, maxPages=${maxPages}, consentClick=${enableConsentClick}`,
  });
  progress({ type: 'scan:phase', message: 'Launching Chromium...' });
  const browser = await chromium.launch({ headless });

  try {
    progress({ type: 'discovery:start', domain });
    discoveredUrls = await discoverPages(browser, domain, timeout);
    const scanCandidateUrls = dedupeBy([domain, ...discoveredUrls], canonicalPageKey);
    scanUrls = prioritizeScanUrls(domain, discoveredUrls, maxPages);
    const duplicateCount = Math.max(0, discoveredUrls.length + 1 - scanCandidateUrls.length);
    discoveredUrlReport = buildDiscoveredUrlReport(discoveredUrls, scanUrls);
    progress({
      type: 'discovery:complete',
      domain,
      discoveredCount: discoveredUrls.length,
      queuedCount: scanUrls.length,
      duplicateCount,
    });

    for (const [index, url] of scanUrls.entries()) {
      progress({ type: 'page:start', index: index + 1, total: scanUrls.length, url });
      const report = await scanSinglePage(browser, domain, url, timeout, enableConsentClick, artifactsDir, { progress });
      pageReports.push(report);

      const pageVendorCount = summarizeVendors([report]).length;
      const pageIdCount = collectAllIds([report]).length;
      const httpStatus = report.statusCode === null || report.statusCode === undefined ? 'n/a' : report.statusCode;
      const pageEvent = {
        type: 'page:complete',
        index: index + 1,
        total: scanUrls.length,
        url,
        status: report.status,
        statusCode: httpStatus === 'n/a' ? null : httpStatus,
        vendorCount: pageVendorCount,
        idCount: pageIdCount,
        networkCount: report.networkFindings.length,
        scriptCount: report.scriptFindings.length,
        retried: Boolean(report.diagnostics?.retriedThinPage),
        error: report.error ? report.error.slice(0, 140) : null,
      };
      if (report.status === 'failed') {
        progress({ type: 'page:failed', url, error: pageEvent.error });
      }
      progress(pageEvent);
    }
  } catch (error) {
    progress({ type: 'scan:error', error: error.message });
    throw error;
  } finally {
    await browser.close();
    progress({ type: 'scan:phase', message: 'Closed Chromium.' });
  }

  const scannedAt = nowIso();
  const finalReport = {
    scannerVersion: SCANNER_VERSION,
    reportTemplateVersion: REPORT_TEMPLATE_VERSION,
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

  progress({ type: 'scan:writing', jsonPath, mdPath });
  fs.writeFileSync(jsonPath, JSON.stringify(finalReport, null, 2), 'utf8');
  fs.writeFileSync(mdPath, buildSummaryMarkdown(finalReport), 'utf8');
  progress({ type: 'scan:phase', message: `Wrote JSON report: ${jsonPath}`, jsonPath });
  progress({ type: 'scan:phase', message: `Wrote Markdown summary: ${mdPath}`, mdPath });
  progress({
    type: 'scan:complete',
    pageCount: pageReports.length,
    vendorCount: finalReport.vendors.length,
    idCount: finalReport.ids.length,
    jsonPath,
    mdPath,
  });

  return {
    finalReport,
    jsonPath,
    mdPath,
  };
}

if (require.main === module) {
  main().then(result => {
    if (result.help || result.version) return;
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
  createProgressEmitter,
  runScanPass,
  scanSinglePage,
  main,
};
