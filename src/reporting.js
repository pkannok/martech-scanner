const { dedupeBy } = require('./utils');

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
  const ids = [];

  for (const report of pageReports) {
    for (const finding of report.networkFindings || []) {
      ids.push(...(finding.ids || []));
    }

    for (const script of report.scriptFindings || []) {
      ids.push(...(script.ids || []));
    }

    if (report.sourceSignals) {
      ids.push(...(report.sourceSignals.inlineScriptIds || []));
      ids.push(...(report.sourceSignals.htmlIds || []));
      ids.push(...(report.sourceSignals.noscriptIds || []));
    }
  }

  return dedupeBy(ids, x => `${x.type}|${x.value}`);
}

function formatConfidence(confidence) {
  if (!confidence?.level) return 'unknown';
  if (typeof confidence.score !== 'number') return confidence.level;
  return `${confidence.level} (${Math.round(confidence.score * 100)}%)`;
}

function formatEvidence(evidence) {
  return evidence?.label || evidence?.type || 'unknown';
}

function buildSummaryMarkdown(finalReport) {
  const lines = [];

  lines.push('# Martech Scan Summary v2.3');
  lines.push('');
  lines.push(`- **Domain:** ${finalReport.domain}`);
  lines.push(`- **Scanned at:** ${finalReport.scannedAt}`);
  lines.push(`- **Pages scanned:** ${finalReport.pageReports.length}`);
  lines.push(`- **Max pages configured:** ${finalReport.config.maxPages}`);
  lines.push(`- **Consent click enabled:** ${finalReport.config.enableConsentClick}`);
  lines.push('');

  lines.push('## Vendors detected');
  lines.push('');

  if (!finalReport.vendors.length) {
    lines.push('No supported vendors were detected by the current rules.');
    lines.push('');
  } else {
    for (const vendor of finalReport.vendors) {
      lines.push(`- **${vendor.name}** (${vendor.category}) via ${vendor.source} - evidence: ${formatEvidence(vendor.evidence)} - confidence: ${formatConfidence(vendor.confidence)}`);
    }
    lines.push('');
  }

  lines.push('## IDs found');
  lines.push('');
  if (!finalReport.ids.length) {
    lines.push('No known IDs were extracted.');
    lines.push('');
  } else {
    for (const id of finalReport.ids) {
      lines.push(`- **${id.type}:** \`${id.value}\``);
    }
    lines.push('');
  }

  lines.push('## Page-level findings');
  lines.push('');

  for (const page of finalReport.pageReports) {
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

    if (page.consentClicks.length) {
      lines.push(`- Consent clicks: ${page.consentClicks.join('; ')}`);
    }

    lines.push(`- Network findings: ${page.networkFindings.length}`);
    lines.push(`- Third-party scripts: ${page.scriptFindings.length}`);
    lines.push(`- Cookies captured: ${page.cookies.length}`);

    const globalFlags = [];
    for (const [name, info] of Object.entries(page.pageGlobals.globals || {})) {
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
        lines.push(`  - ${id.type}: ${id.value}`);
      }
    }

    lines.push('');
  }

  lines.push('## Caveats');
  lines.push('');
  lines.push('- Each page is scanned in a fresh browser context to reduce cache/state contamination.');
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
  buildSummaryMarkdown,
};
