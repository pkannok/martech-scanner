const { dedupeBy } = require('./utils');
const { SCANNER_VERSION, REPORT_TEMPLATE_VERSION } = require('./version');

const COVERAGE_LIST_LIMIT = 20;

const EVIDENCE_TYPE_GUIDE = {
  network: {
    label: 'Network evidence',
    description: 'A browser request to a recognized vendor endpoint was observed during the scan.',
    limitation: 'Shows runtime browser activity on the scanned page, but does not by itself prove business rules, consent correctness, or full implementation.',
  },
  script: {
    label: 'Script evidence',
    description: 'A loaded script URL or third-party script element matched a known vendor rule or contained a known ID.',
    limitation: 'Shows that a script was present or requested, but not that every tag inside it fired successfully.',
  },
  source: {
    label: 'Source evidence',
    description: 'A known ID or signal was found in HTML, inline JavaScript, global previews, or extracted source-level URL text.',
    limitation: 'Shows configuration or identifiers in browser-visible source, but not observed firing.',
  },
  cookie: {
    label: 'Cookie evidence',
    description: 'Cookies visible to the browser context were captured for a scanned page.',
    limitation: 'Cookie names and values can hint at tooling or state, but are not treated as standalone proof of a vendor implementation.',
  },
  iframe_noscript: {
    label: 'Iframe / noscript evidence',
    description: 'Iframe URLs or noscript blocks exposed known IDs or vendor-related source signals.',
    limitation: 'Often reflects fallback or embedded markup; review alongside network and script evidence before drawing conclusions.',
  },
  global: {
    label: 'Global object evidence',
    description: 'Known browser globals such as data layers or tag-manager objects were present on the page.',
    limitation: 'Shows that a page-level object exists, but not that any destination received data.',
  },
  inferred: {
    label: 'Inferred / rule-match evidence',
    description: 'A vendor was inferred from source-level IDs, globals, or rule matches rather than a direct observed vendor request.',
    limitation: 'Useful for triage, but should be verified before treating it as a confirmed live implementation.',
  },
};

const VENDOR_CONFIDENCE = {
  network: {
    level: 'high',
    score: 0.95,
    reason: 'Observed browser request matched a known vendor endpoint.',
  },
  script: {
    level: 'high',
    score: 0.85,
    reason: 'Loaded third-party script URL matched a known vendor rule.',
  },
  source_code: {
    level: 'medium',
    score: 0.65,
    reason: 'Vendor-specific ID or global was present in page source.',
  },
};

const VENDOR_EVIDENCE = {
  network: {
    type: 'observed_firing',
    label: 'observed firing',
    reason: 'A browser request to a known vendor endpoint was observed during the scan.',
  },
  script: {
    type: 'present_in_source',
    label: 'present in source',
    reason: 'A third-party script URL matching a known vendor rule was present on the page.',
  },
  source_code: {
    type: 'inferred',
    label: 'inferred',
    reason: 'The vendor was inferred from vendor-specific IDs or globals found in page source.',
  },
};

function confidenceForSource(source) {
  return {
    ...(VENDOR_CONFIDENCE[source] || {
      level: 'low',
      score: 0.4,
      reason: 'Matched a vendor rule with limited supporting evidence.',
    }),
  };
}

function evidenceForSource(source) {
  return {
    ...(VENDOR_EVIDENCE[source] || {
      type: 'inferred',
      label: 'inferred',
      reason: 'The vendor matched a rule with limited direct evidence.',
    }),
  };
}

function vendorFinding(name, category, source) {
  return {
    name,
    category,
    source,
    evidence: evidenceForSource(source),
    confidence: confidenceForSource(source),
  };
}

function pageHasId(report, type) {
  return (
    (report.sourceSignals?.htmlIds || []).some(x => x.type === type) ||
    (report.sourceSignals?.inlineScriptIds || []).some(x => x.type === type) ||
    (report.sourceSignals?.noscriptIds || []).some(x => x.type === type)
  );
}

function summarizeVendors(pageReports) {
  const all = [];

  for (const report of pageReports) {
    for (const finding of report.networkFindings || []) {
      all.push(vendorFinding(finding.vendor.name, finding.vendor.category, 'network'));
    }

    for (const script of report.scriptFindings || []) {
      for (const vendor of script.detectedVendors || []) {
        all.push(vendorFinding(vendor.name, vendor.category, 'script'));
      }
    }

    const hasGA4Id = pageHasId(report, 'GA4 Measurement ID');
    const hasUAId = pageHasId(report, 'UA Property ID');
    const hasAdsId =
      pageHasId(report, 'Google Ads ID') ||
      pageHasId(report, 'DoubleClick Advertiser ID');
    const hasMetaId = pageHasId(report, 'Facebook Pixel ID');
    const hasTikTokId = pageHasId(report, 'TikTok Pixel ID');
    const hasTradeDeskId = pageHasId(report, 'The Trade Desk Advertiser ID');

    if (hasGA4Id || hasUAId) {
      all.push(vendorFinding('Google Analytics', 'analytics', 'source_code'));
    }

    if (hasAdsId) {
      all.push(vendorFinding('Google Ads / DoubleClick', 'media_pixel', 'source_code'));
    }

    if (hasMetaId) {
      all.push(vendorFinding('Meta Pixel', 'media_pixel', 'source_code'));
    }

    if (hasTikTokId) {
      all.push(vendorFinding('TikTok Pixel', 'media_pixel', 'source_code'));
    }

    if (hasTradeDeskId) {
      all.push(vendorFinding('The Trade Desk', 'media_pixel', 'source_code'));
    }

    if (
      (report.sourceSignals?.googleGlobals?.google_tag_manager ||
        (report.sourceSignals?.htmlIds || []).some(x => x.type === 'GTM Container ID') ||
        (report.sourceSignals?.inlineScriptIds || []).some(x => x.type === 'GTM Container ID') ||
        (report.sourceSignals?.noscriptIds || []).some(x => x.type === 'GTM Container ID'))
    ) {
      all.push(vendorFinding('Google Tag Manager', 'tag_manager', 'source_code'));
    }
  }

  return dedupeBy(all, x => `${x.name}|${x.category}|${x.source}`);
}

function collectAllIds(pageReports) {
  return collectIdEvidenceDetails(pageReports);
}

function formatConfidence(confidence) {
  if (!confidence?.level) return 'unknown';
  if (typeof confidence.score !== 'number') return confidence.level;
  return `${confidence.level} (${Math.round(confidence.score * 100)}%)`;
}

function formatEvidence(evidence) {
  return evidence?.label || evidence?.type || 'unknown';
}

function evidenceTypeLabel(type) {
  return EVIDENCE_TYPE_GUIDE[type]?.label || type || 'Unknown evidence';
}

function formatEvidenceTypes(types) {
  const uniqueTypes = dedupeBy((types || []).filter(Boolean), x => x);
  if (!uniqueTypes.length) return 'not labeled';
  return uniqueTypes.map(evidenceTypeLabel).join(', ');
}

function addIdEvidence(idMap, id, evidenceType) {
  if (!id?.type || !id?.value) return;

  const key = `${id.type}|${id.value}`;
  const existing = idMap.get(key) || {
    type: id.type,
    value: id.value,
    evidenceTypes: [],
  };

  existing.evidenceTypes = dedupeBy([...existing.evidenceTypes, evidenceType], x => x);
  idMap.set(key, existing);
}

function collectIdEvidenceDetails(pageReports) {
  const ids = new Map();

  for (const report of pageReports || []) {
    for (const finding of report.networkFindings || []) {
      for (const id of finding.ids || []) {
        addIdEvidence(ids, id, 'network');
      }
    }

    for (const script of report.scriptFindings || []) {
      for (const id of script.ids || []) {
        addIdEvidence(ids, id, 'script');
      }
    }

    for (const id of report.sourceSignals?.htmlIds || []) {
      addIdEvidence(ids, id, 'source');
    }

    for (const id of report.sourceSignals?.inlineScriptIds || []) {
      addIdEvidence(ids, id, 'source');
    }

    for (const id of report.sourceSignals?.noscriptIds || []) {
      addIdEvidence(ids, id, 'iframe_noscript');
    }
  }

  return [...ids.values()];
}

function countDiscoveredUrls(finalReport) {
  if (!Array.isArray(finalReport.discovered_urls)) return null;
  return finalReport.discovered_urls.length;
}

function countSkippedUrls(finalReport) {
  if (!Array.isArray(finalReport.discovered_urls)) return null;
  return finalReport.discovered_urls.filter(url => url && url.scanned === false).length;
}

function countFailedPages(pageReports) {
  return pageReports.filter(page => page.status === 'failed').length;
}

function pageSourceIdCount(page) {
  return (
    (page.sourceSignals?.htmlIds?.length || 0) +
    (page.sourceSignals?.inlineScriptIds?.length || 0) +
    (page.sourceSignals?.noscriptIds?.length || 0)
  );
}

function pageEvidenceCounts(page) {
  return {
    network: (page.networkFindings || []).length,
    scripts: (page.scriptFindings || []).length,
    sourceIds: pageSourceIdCount(page),
    cookies: (page.cookies || []).length,
  };
}

function pageEvidenceTotal(page) {
  const counts = pageEvidenceCounts(page);
  return counts.network + counts.scripts + counts.sourceIds + counts.cookies;
}

function hasPresentGlobal(page) {
  return Object.values(page.pageGlobals?.globals || {}).some(info => info?.present) ||
    Object.values(page.sourceSignals?.googleGlobals || {}).some(Boolean);
}

function collectEvidenceTypes(finalReport) {
  const pageReports = Array.isArray(finalReport.pageReports) ? finalReport.pageReports : [];
  const types = new Set();

  if ((finalReport.vendors || []).some(vendor => vendor.source === 'network')) types.add('network');
  if ((finalReport.vendors || []).some(vendor => vendor.source === 'script')) types.add('script');
  if ((finalReport.vendors || []).some(vendor => vendor.source === 'source_code')) types.add('source');
  if ((finalReport.vendors || []).some(vendor => vendor.evidence?.type === 'inferred')) types.add('inferred');

  for (const page of pageReports) {
    if ((page.networkFindings || []).length) types.add('network');
    if ((page.scriptFindings || []).length) types.add('script');
    if ((page.cookies || []).length) types.add('cookie');
    if ((page.sourceSignals?.htmlIds || []).length || (page.sourceSignals?.inlineScriptIds || []).length) {
      types.add('source');
    }
    if ((page.sourceSignals?.iframes || []).length || (page.sourceSignals?.noscriptIds || []).length) {
      types.add('iframe_noscript');
    }
    if (hasPresentGlobal(page)) types.add('global');
  }

  for (const id of finalReport.ids || []) {
    for (const evidenceType of id.evidenceTypes || []) {
      types.add(evidenceType);
    }
  }

  return ['network', 'script', 'source', 'cookie', 'iframe_noscript', 'global', 'inferred']
    .filter(type => types.has(type));
}

function isThinOrLowEvidencePage(page) {
  if (!page || page.status !== 'ok') return false;
  if (page.diagnostics?.retriedThinPage) return true;
  return (
    (page.networkFindings?.length || 0) === 0 &&
    (page.scriptFindings?.length || 0) === 0 &&
    pageSourceIdCount(page) === 0
  );
}

function consentSummary(finalReport, pageReports) {
  const consentConfigured = finalReport.config?.enableConsentClick;
  const pagesWithClicks = pageReports.filter(page => (page.consentClicks || []).length > 0);

  if (consentConfigured === undefined && !pagesWithClicks.length) return null;

  if (consentConfigured === false) {
    return 'Disabled for this scan.';
  }

  if (pagesWithClicks.length) {
    return `Enabled; interaction captured on ${pagesWithClicks.length} of ${pageReports.length} page(s).`;
  }

  if (consentConfigured === true) {
    return 'Enabled; no consent interaction was captured.';
  }

  return `Interaction captured on ${pagesWithClicks.length} page(s).`;
}

function formatPageEvidenceCounts(page) {
  const counts = pageEvidenceCounts(page);
  return `${counts.network} network, ${counts.scripts} scripts, ${counts.sourceIds} source IDs, ${counts.cookies} cookies`;
}

function pageCoverageNotes(page) {
  const notes = [];

  if (page.status === 'failed') {
    notes.push(page.error && /timeout/i.test(page.error) ? 'timeout' : 'navigation failure');
  }

  if (page.statusCode !== null && page.statusCode !== undefined && page.statusCode >= 400) {
    notes.push(`HTTP ${page.statusCode} response`);
  }

  if (isThinOrLowEvidencePage(page)) {
    notes.push('thin / low-evidence page');
  }

  if (page.diagnostics?.retriedThinPage) {
    notes.push('retry attempted');
  }

  if (page.diagnostics?.retryReason) {
    notes.push(`retry reason: ${page.diagnostics.retryReason}`);
  }

  if (page.error && !notes.some(note => note.includes(page.error))) {
    notes.push(`error: ${page.error}`);
  }

  return notes.length ? notes.join('; ') : 'none';
}

function skippedUrlReason(discoveredUrl) {
  return discoveredUrl?.skipReason || discoveredUrl?.reason || 'not recorded';
}

function addLimitedList(lines, items, limit, renderItem, omittedLabel) {
  const visibleItems = items.slice(0, limit);

  for (const item of visibleItems) {
    renderItem(item);
  }

  const omitted = items.length - visibleItems.length;
  if (omitted > 0) {
    lines.push(`- ${omitted} additional ${omittedLabel} omitted from Markdown.`);
  }
}

function addScanCoverage(lines, finalReport) {
  const pageReports = Array.isArray(finalReport.pageReports) ? finalReport.pageReports : [];
  const discoveredUrls = Array.isArray(finalReport.discovered_urls) ? finalReport.discovered_urls : null;
  const skippedUrls = discoveredUrls ? discoveredUrls.filter(url => url && url.scanned === false) : [];
  const failedOrPartialPages = pageReports.filter(page =>
    page.status === 'failed' ||
    page.error ||
    (page.statusCode !== null && page.statusCode !== undefined && page.statusCode >= 400)
  );
  const thinPageCount = pageReports.filter(isThinOrLowEvidencePage).length;

  lines.push('## Scan Coverage');
  lines.push('');
  lines.push('Coverage is limited to the URLs discovered and selected during this run.');
  lines.push('');
  lines.push(`- Seed / target: ${finalReport.domain || finalReport.seedUrl || 'Not specified'}`);
  lines.push(`- Total pages scanned: ${pageReports.length}`);
  lines.push(`- Total URLs discovered: ${discoveredUrls ? discoveredUrls.length : 'not recorded'}`);
  lines.push(`- Discovered but not scanned: ${discoveredUrls ? skippedUrls.length : 'not recorded'}`);
  lines.push(`- Failed pages: ${countFailedPages(pageReports)}`);
  lines.push(`- Thin / low-evidence pages: ${pageReports.length ? thinPageCount : 'not recorded'}`);
  lines.push('');

  lines.push('### Scanned Pages');
  lines.push('');
  if (!pageReports.length) {
    lines.push('No scanned pages were recorded.');
    lines.push('');
  } else {
    addLimitedList(lines, pageReports, COVERAGE_LIST_LIMIT, page => {
      const httpStatus = page.statusCode === null || page.statusCode === undefined ? 'n/a' : page.statusCode;
      lines.push(`- ${page.url}`);
      lines.push(`  - Status: ${page.status || 'unknown'}; HTTP: ${httpStatus}`);
      lines.push(`  - Evidence counts: ${formatPageEvidenceCounts(page)}`);
      lines.push(`  - Notes: ${pageCoverageNotes(page)}`);
    }, 'scanned page(s)');
    lines.push('');
  }

  lines.push('### Discovered but Not Scanned');
  lines.push('');
  if (!discoveredUrls) {
    lines.push('Discovery metadata was not recorded for this report.');
    lines.push('');
  } else if (!skippedUrls.length) {
    lines.push('No discovered URLs were marked as not scanned.');
    lines.push('');
  } else {
    addLimitedList(lines, skippedUrls, COVERAGE_LIST_LIMIT, discoveredUrl => {
      const rank = discoveredUrl.rank ? `rank ${discoveredUrl.rank}` : 'rank not recorded';
      lines.push(`- ${discoveredUrl.url}`);
      lines.push(`  - Reason: ${skippedUrlReason(discoveredUrl)}`);
      lines.push(`  - Discovery rank: ${rank}`);
    }, 'discovered-but-not-scanned URL(s)');
    lines.push('');
  }

  lines.push('### Failed or Partial Pages');
  lines.push('');
  if (!failedOrPartialPages.length) {
    lines.push('No failed or partial pages were recorded.');
    lines.push('');
  } else {
    addLimitedList(lines, failedOrPartialPages, COVERAGE_LIST_LIMIT, page => {
      const httpStatus = page.statusCode === null || page.statusCode === undefined ? 'n/a' : page.statusCode;
      const reason = page.error || (httpStatus === 'n/a' ? 'not recorded' : `HTTP ${httpStatus}`);
      lines.push(`- ${page.url}`);
      lines.push(`  - Reason: ${reason}`);
      lines.push(`  - Partial evidence captured: ${pageEvidenceTotal(page) > 0 ? 'yes' : 'no'}`);
    }, 'failed/partial page(s)');
    lines.push('');
  }
}

function addEvidenceTypeGuide(lines, finalReport) {
  const evidenceTypes = collectEvidenceTypes(finalReport);

  lines.push('## Evidence Type Guide');
  lines.push('');

  if (!evidenceTypes.length) {
    lines.push('No labeled evidence types were present in this report.');
    lines.push('');
    return;
  }

  lines.push('Evidence type describes where the scanner saw a signal. It does not, by itself, prove full implementation, correct configuration, or compliance status.');
  lines.push('');

  for (const type of evidenceTypes) {
    const guide = EVIDENCE_TYPE_GUIDE[type];
    lines.push(`- **${guide.label}:** ${guide.description} Limitation: ${guide.limitation}`);
  }

  lines.push('');
}

function addExecutiveSummary(lines, finalReport) {
  const pageReports = Array.isArray(finalReport.pageReports) ? finalReport.pageReports : [];
  const pagesScanned = pageReports.length || (Array.isArray(finalReport.scanUrls) ? finalReport.scanUrls.length : null);
  const discoveredUrlCount = countDiscoveredUrls(finalReport);
  const skippedUrlCount = countSkippedUrls(finalReport);
  const failedPageCount = countFailedPages(pageReports);
  const thinPageCount = pageReports.filter(isThinOrLowEvidencePage).length;
  const consentStatus = consentSummary(finalReport, pageReports);
  const artifactLocation = finalReport.artifactLocation || finalReport.artifactsDir || finalReport.outputDir || null;

  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`- Target: ${finalReport.domain || finalReport.seedUrl || 'Not specified'}`);

  if (finalReport.scanStartedAt && finalReport.scanEndedAt) {
    lines.push(`- Scan window: ${finalReport.scanStartedAt} to ${finalReport.scanEndedAt}`);
  } else if (finalReport.scannedAt) {
    lines.push(`- Generated at: ${finalReport.scannedAt}`);
  }

  if (pagesScanned !== null) {
    lines.push(`- Pages scanned: ${pagesScanned}`);
  }

  if (discoveredUrlCount !== null) {
    lines.push(`- Discovered URLs: ${discoveredUrlCount}`);
  }

  if (skippedUrlCount !== null) {
    lines.push(`- Skipped / not scanned URLs: ${skippedUrlCount}`);
  }

  lines.push(`- Failed pages: ${failedPageCount}`);
  lines.push(`- Vendors detected: ${(finalReport.vendors || []).length}`);
  lines.push(`- IDs detected: ${(finalReport.ids || []).length}`);

  if (consentStatus) {
    lines.push(`- Consent interaction: ${consentStatus}`);
  }

  if (pageReports.length) {
    lines.push(`- Thin / low-evidence pages: ${thinPageCount}`);
  }

  if (artifactLocation) {
    lines.push(`- Artifact location: ${artifactLocation}`);
  }

  lines.push('');
  lines.push('This report reflects browser-visible evidence from the scanned pages only and should be reviewed by an analyst before being treated as complete.');
  lines.push('');
}

function buildSummaryMarkdown(finalReport) {
  const lines = [];
  const pageReports = Array.isArray(finalReport.pageReports) ? finalReport.pageReports : [];
  const config = finalReport.config || {};

  lines.push('# MarTech Scan Summary');
  lines.push('');
  lines.push(`- **Scanner version:** ${finalReport.scannerVersion || SCANNER_VERSION}`);
  lines.push(`- **Report template version:** ${finalReport.reportTemplateVersion || REPORT_TEMPLATE_VERSION}`);
  lines.push(`- **Domain:** ${finalReport.domain || finalReport.seedUrl || 'Not specified'}`);
  lines.push(`- **Scanned at:** ${finalReport.scannedAt || finalReport.scanEndedAt || 'Not specified'}`);
  lines.push(`- **Pages scanned:** ${pageReports.length}`);
  lines.push(`- **Max pages configured:** ${config.maxPages ?? 'Not specified'}`);
  lines.push(`- **Consent click enabled:** ${config.enableConsentClick ?? 'Not specified'}`);
  lines.push('');

  addExecutiveSummary(lines, finalReport);
  addScanCoverage(lines, finalReport);
  addEvidenceTypeGuide(lines, finalReport);

  lines.push('## Vendors detected');
  lines.push('');

  if (!(finalReport.vendors || []).length) {
    lines.push('No supported vendors were detected by the current rules.');
    lines.push('');
  } else {
    for (const vendor of finalReport.vendors || []) {
      const evidenceType = vendor.source === 'source_code' ? 'source' : vendor.source;
      lines.push(`- **${vendor.name}** (${vendor.category}) via ${vendor.source} - evidence type: ${formatEvidenceTypes([evidenceType])} (${formatEvidence(vendor.evidence)}) - confidence: ${formatConfidence(vendor.confidence)}`);
    }
    lines.push('');
  }

  lines.push('## IDs found');
  lines.push('');
  if (!(finalReport.ids || []).length) {
    lines.push('No known IDs were extracted.');
    lines.push('');
  } else {
    for (const id of finalReport.ids || []) {
      lines.push(`- **${id.type}:** \`${id.value}\` - evidence type: ${formatEvidenceTypes(id.evidenceTypes)}`);
    }
    lines.push('');
  }

  lines.push('## Page-level findings');
  lines.push('');

  for (const page of pageReports) {
    lines.push(`### ${page.url}`);
    lines.push(`- Status: ${page.status}`);

    if (page.statusCode !== null && page.statusCode !== undefined) {
      lines.push(`- HTTP status: ${page.statusCode}`);
    }

    if (page.error) {
      lines.push(`- Error: ${page.error}`);
    }

    if (page.title) {
      lines.push(`- Title: ${page.title}`);
    }

    const consentClicks = page.consentClicks || [];
    const networkFindings = page.networkFindings || [];
    const scriptFindings = page.scriptFindings || [];
    const cookies = page.cookies || [];
    const pageGlobals = page.pageGlobals || { globals: {} };

    if (consentClicks.length) {
      lines.push(`- Consent clicks: ${consentClicks.join('; ')}`);
    }

    lines.push(`- Network findings: ${networkFindings.length}`);
    lines.push(`- Third-party scripts: ${scriptFindings.length}`);
    lines.push(`- Cookies captured: ${cookies.length}`);

    const globalFlags = [];
    for (const [name, info] of Object.entries(pageGlobals.globals || {})) {
      if (info && info.present) globalFlags.push(name);
    }
    if (globalFlags.length) {
      lines.push(`- Globals present: ${globalFlags.join(', ')}`);
    }

    const sourceFlags = [];
    if (page.sourceSignals?.googleGlobals?.google_tag_manager) sourceFlags.push('google_tag_manager');
    if (page.sourceSignals?.googleGlobals?.gtag) sourceFlags.push('gtag');
    if (page.sourceSignals?.googleGlobals?.dataLayerPresent) sourceFlags.push('dataLayer');
    if (sourceFlags.length) {
      lines.push(`- Google source signals: ${sourceFlags.join(', ')}`);
    }

    const sourceIdCount =
      (page.sourceSignals?.htmlIds?.length || 0) +
      (page.sourceSignals?.inlineScriptIds?.length || 0) +
      (page.sourceSignals?.noscriptIds?.length || 0);

    lines.push(`- Source-derived IDs: ${sourceIdCount}`);

    const sourceIds = [
      ...(page.sourceSignals?.htmlIds || []),
      ...(page.sourceSignals?.inlineScriptIds || []),
      ...(page.sourceSignals?.noscriptIds || []),
    ];

    const uniqueSourceIds = dedupeBy(sourceIds, x => `${x.type}|${x.value}`);
    if (uniqueSourceIds.length) {
      for (const id of uniqueSourceIds) {
        const sourceType = (page.sourceSignals?.noscriptIds || []).some(item => item.type === id.type && item.value === id.value)
          ? 'iframe_noscript'
          : 'source';
        lines.push(`  - ${id.type}: ${id.value} (${evidenceTypeLabel(sourceType)})`);
      }
    }

    lines.push('');
  }

  lines.push('## Caveats');
  lines.push('');
  lines.push('- Each page is scanned in a fresh browser context to reduce cache/state contamination.');
  lines.push('- Coverage is limited to the URLs discovered and selected during this run.');
  lines.push('- IDs may come from network traffic, script URLs, HTML, inline scripts, iframe URLs, noscript blocks, and request bodies.');
  lines.push('- This scanner still only observes what is available through public browser activity.');
  lines.push('- It may miss deferred tags, server-side tagging, login-gated tooling, and non-fired rules.');
  lines.push('');

  return lines.join('\n');
}

module.exports = {
  confidenceForSource,
  evidenceForSource,
  summarizeVendors,
  collectAllIds,
  collectIdEvidenceDetails,
  addExecutiveSummary,
  addScanCoverage,
  addEvidenceTypeGuide,
  buildSummaryMarkdown,
};
