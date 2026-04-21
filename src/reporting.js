const { dedupeBy } = require('./utils');

function summarizeVendors(pageReports) {
  const all = [];

  for (const report of pageReports) {
    for (const finding of report.networkFindings || []) {
      all.push({
        name: finding.vendor.name,
        category: finding.vendor.category,
        source: 'network',
      });
    }

    for (const script of report.scriptFindings || []) {
      for (const vendor of script.detectedVendors || []) {
        all.push({
          name: vendor.name,
          category: vendor.category,
          source: 'script',
        });
      }
    }

    const hasGA4Id =
      (report.sourceSignals?.htmlIds || []).some(x => x.type === 'GA4 Measurement ID') ||
      (report.sourceSignals?.inlineScriptIds || []).some(x => x.type === 'GA4 Measurement ID') ||
      (report.sourceSignals?.noscriptIds || []).some(x => x.type === 'GA4 Measurement ID');

    const hasAdsId =
      (report.sourceSignals?.htmlIds || []).some(x => x.type === 'Google Ads ID') ||
      (report.sourceSignals?.inlineScriptIds || []).some(x => x.type === 'Google Ads ID') ||
      (report.sourceSignals?.noscriptIds || []).some(x => x.type === 'Google Ads ID');

    if (hasGA4Id) {
      all.push({
        name: 'Google Analytics',
        category: 'analytics',
        source: 'source_code',
      });
    }

    if (hasAdsId) {
      all.push({
        name: 'Google Ads / DoubleClick',
        category: 'media_pixel',
        source: 'source_code',
      });
    }

    if (
      (report.sourceSignals?.googleGlobals?.google_tag_manager ||
        (report.sourceSignals?.htmlIds || []).some(x => x.type === 'GTM Container ID') ||
        (report.sourceSignals?.inlineScriptIds || []).some(x => x.type === 'GTM Container ID') ||
        (report.sourceSignals?.noscriptIds || []).some(x => x.type === 'GTM Container ID'))
    ) {
      all.push({
        name: 'Google Tag Manager',
        category: 'tag_manager',
        source: 'source_code',
      });
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
      lines.push(`- **${vendor.name}** (${vendor.category}) via ${vendor.source}`);
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
  summarizeVendors,
  collectAllIds,
  buildSummaryMarkdown,
};