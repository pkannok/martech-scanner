const {
  detectVendorFromUrl,
  extractIdsFromUrl,
  extractIdsFromTextBlock,
} = require('./detectors');

const {
  collectThirdPartyScripts,
  inspectPageGlobals,
  inspectPageSourceSignals,
  collectCookies,
} = require('./inspectors');

const {
  confidenceForSource,
  evidenceForSource,
} = require('./reporting');

const { dedupeBy, nowIso } = require('./utils');

const GLOBAL_PREVIEW_KEYS = [
  'dataLayer',
  'adobeDataLayer',
  'digitalData',
  'utag_data',
  '__NEXT_DATA__',
  '__INITIAL_STATE__',
];

function extractIdsFromGlobalPreviews(pageGlobals) {
  const ids = [];

  for (const key of GLOBAL_PREVIEW_KEYS) {
    const preview = pageGlobals?.globals?.[key]?.preview;
    if (preview) ids.push(...extractIdsFromTextBlock(preview));
  }

  return ids;
}

function buildSourceSignals(sourceSignals, pageGlobals, options = {}) {
  const globalPreviewIds = extractIdsFromGlobalPreviews(pageGlobals);
  const htmlIds = [...extractIdsFromTextBlock(sourceSignals.htmlSnippet || '')];

  if (options.globalPreviewPosition !== 'after_urls') {
    htmlIds.push(...globalPreviewIds);
  }

  const inlineScriptIds = [];
  for (const scriptText of sourceSignals.inlineScripts || []) {
    inlineScriptIds.push(...extractIdsFromTextBlock(scriptText));
  }

  const noscriptIds = [];
  for (const text of sourceSignals.noscriptText || []) {
    noscriptIds.push(...extractIdsFromTextBlock(text));
  }

  for (const iframeSrc of sourceSignals.iframes || []) {
    htmlIds.push(...extractIdsFromUrl(iframeSrc));
  }

  for (const extSrc of sourceSignals.externalScripts || []) {
    htmlIds.push(...extractIdsFromUrl(extSrc));
  }

  if (options.globalPreviewPosition === 'after_urls') {
    htmlIds.push(...globalPreviewIds);
  }

  return {
    externalScripts: sourceSignals.externalScripts || [],
    iframes: sourceSignals.iframes || [],
    inlineScriptIds: dedupeBy(inlineScriptIds, x => `${x.type}|${x.value}`),
    htmlIds: dedupeBy(htmlIds, x => `${x.type}|${x.value}`),
    noscriptIds: dedupeBy(noscriptIds, x => `${x.type}|${x.value}`),
    googleGlobals: sourceSignals.globals || {},
  };
}

function collectRequestEvidenceFromRequest(request, options = {}) {
  const url = request.url();
  const vendors = detectVendorFromUrl(url);
  if (!vendors.length) return [];

  const postData = request.postData() || '';
  const ids = dedupeBy(
    [
      ...extractIdsFromUrl(url),
      ...extractIdsFromTextBlock(postData, { sourceUrl: url }),
    ],
    x => `${x.type}|${x.value}`
  );
  const source = options.sourceLabel || 'network';
  const timestamp = typeof options.now === 'function' ? options.now() : nowIso();

  return vendors.map(vendor => ({
    vendor,
    evidence: evidenceForSource(source),
    confidence: confidenceForSource(source),
    url,
    method: request.method(),
    resourceType: request.resourceType(),
    ids,
    postDataPreview: postData.slice(0, 2000),
    timestamp,
  }));
}

function createRequestEvidenceRecorder(page, options = {}) {
  const events = [];
  const onRequest = request => {
    events.push(...collectRequestEvidenceFromRequest(request, options));
  };

  page.on('request', onRequest);

  return {
    events,
    dispose() {
      if (typeof page.off === 'function') page.off('request', onRequest);
    },
  };
}

function collectScriptFindingsFromPage(page, baseUrl) {
  return collectThirdPartyScripts(page, baseUrl).then(scripts =>
    dedupeBy(
      scripts
        .filter(script => script.thirdParty)
        .map(script => {
          const detectedVendors = detectVendorFromUrl(script.src);
          const ids = extractIdsFromUrl(script.src);

          return {
            src: script.src,
            detectedVendors,
            ids,
            evidence: evidenceForSource('script'),
            confidence: confidenceForSource(detectedVendors.length ? 'script' : 'source_code'),
          };
        })
        .filter(item =>
          item.detectedVendors.length > 0 ||
          item.ids.length > 0 ||
          /gtag\/js|gtm\.js|google-analytics|doubleclick|googleadservices|googlesyndication/i.test(item.src)
        ),
      x => x.src
    )
  );
}

function normalizeNetworkFindings(events) {
  return dedupeBy(
    (events || []).map(event => ({
      vendor: event.vendor,
      evidence: event.evidence,
      confidence: event.confidence,
      url: event.url,
      method: event.method,
      resourceType: event.resourceType,
      ids: event.ids,
      postDataPreview: event.postDataPreview,
      timestamp: event.timestamp,
    })),
    x => `${x.vendor.name}|${x.method}|${x.url}`
  );
}

async function collectSourceEvidence(page, context, options = {}) {
  const phase = options.phase || 'source';
  const pageGlobals = await inspectPageGlobals(page);
  const rawSourceSignals = await inspectPageSourceSignals(page);
  const evidence = {
    phase,
    sourceLabel: options.sourceLabel || null,
    title: pageGlobals.title || '',
    pageGlobals,
    sourceSignals: buildSourceSignals(rawSourceSignals, pageGlobals, {
      globalPreviewPosition: options.globalPreviewPosition || (phase === 'baseline' ? 'before_urls' : 'after_urls'),
    }),
    scriptFindings: [],
    cookies: [],
    networkFindings: [],
  };

  if (options.includeScripts) {
    evidence.scriptFindings = await collectScriptFindingsFromPage(page, options.baseUrl);
  }

  if (options.includeCookies) {
    evidence.cookies = await collectCookies(context, page.url());
  }

  if (options.includeNetwork) {
    evidence.networkFindings = normalizeNetworkFindings(options.requestEvents || []);
  }

  return evidence;
}

function ensureReportEvidenceContainers(report) {
  report.networkFindings = report.networkFindings || [];
  report.scriptFindings = report.scriptFindings || [];
  report.cookies = report.cookies || [];
  report.pageGlobals = report.pageGlobals || { globals: {} };
  report.pageGlobals.globals = report.pageGlobals.globals || {};
  report.sourceSignals = report.sourceSignals || {};
  report.sourceSignals.externalScripts = report.sourceSignals.externalScripts || [];
  report.sourceSignals.iframes = report.sourceSignals.iframes || [];
  report.sourceSignals.inlineScriptIds = report.sourceSignals.inlineScriptIds || [];
  report.sourceSignals.htmlIds = report.sourceSignals.htmlIds || [];
  report.sourceSignals.noscriptIds = report.sourceSignals.noscriptIds || [];
  report.sourceSignals.googleGlobals = report.sourceSignals.googleGlobals || {};
}

function mergeAppearingGlobals(targetGlobals, incomingGlobals) {
  for (const [key, value] of Object.entries(incomingGlobals || {})) {
    const existingValue = targetGlobals[key];
    if (!existingValue?.present && value?.present) {
      targetGlobals[key] = value;
    }
  }
}

function replaceSourceSignals(target, sourceSignals) {
  target.sourceSignals = {
    externalScripts: sourceSignals.externalScripts || [],
    iframes: sourceSignals.iframes || [],
    inlineScriptIds: dedupeBy(sourceSignals.inlineScriptIds || [], x => `${x.type}|${x.value}`),
    htmlIds: dedupeBy(sourceSignals.htmlIds || [], x => `${x.type}|${x.value}`),
    noscriptIds: dedupeBy(sourceSignals.noscriptIds || [], x => `${x.type}|${x.value}`),
    googleGlobals: sourceSignals.googleGlobals || {},
  };
}

function mergeSourceSignals(target, sourceSignals, options = {}) {
  target.sourceSignals.googleGlobals = {
    ...target.sourceSignals.googleGlobals,
    ...(sourceSignals.googleGlobals || {}),
  };

  target.sourceSignals.htmlIds = dedupeBy(
    [...target.sourceSignals.htmlIds, ...(sourceSignals.htmlIds || [])],
    x => `${x.type}|${x.value}`
  );
  target.sourceSignals.inlineScriptIds = dedupeBy(
    [...target.sourceSignals.inlineScriptIds, ...(sourceSignals.inlineScriptIds || [])],
    x => `${x.type}|${x.value}`
  );
  target.sourceSignals.noscriptIds = dedupeBy(
    [...target.sourceSignals.noscriptIds, ...(sourceSignals.noscriptIds || [])],
    x => `${x.type}|${x.value}`
  );

  if (options.mergeSourceLists) {
    target.sourceSignals.externalScripts = dedupeBy(
      [...target.sourceSignals.externalScripts, ...(sourceSignals.externalScripts || [])],
      x => x
    );
    target.sourceSignals.iframes = dedupeBy(
      [...target.sourceSignals.iframes, ...(sourceSignals.iframes || [])],
      x => x
    );
  }
}

function mergeSourceEvidence(target, evidence, options = {}) {
  ensureReportEvidenceContainers(target);

  if (options.replacePageGlobals) {
    target.pageGlobals = evidence.pageGlobals || target.pageGlobals;
    target.title = evidence.title || '';
  } else if (evidence.pageGlobals?.globals) {
    mergeAppearingGlobals(target.pageGlobals.globals, evidence.pageGlobals.globals);
  }

  if (options.replaceSourceSignals) {
    replaceSourceSignals(target, evidence.sourceSignals || {});
  } else {
    mergeSourceSignals(target, evidence.sourceSignals || {}, options);
  }

  target.scriptFindings = dedupeBy(
    [...target.scriptFindings, ...(evidence.scriptFindings || [])],
    x => x.src
  );
  target.cookies = dedupeBy(
    [...target.cookies, ...(evidence.cookies || [])],
    x => `${x.name}|${x.domain}|${x.path}`
  );
  target.networkFindings = dedupeBy(
    [...target.networkFindings, ...(evidence.networkFindings || [])],
    x => `${x.vendor.name}|${x.method}|${x.url}`
  );

  return target;
}

module.exports = {
  collectRequestEvidenceFromRequest,
  createRequestEvidenceRecorder,
  collectSourceEvidence,
  mergeSourceEvidence,
};
