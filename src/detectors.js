const { ID_RULES, VENDOR_SCOPED_ID_RULES } = require('./config');
const { dedupeBy } = require('./utils');
const { evaluateVendorRules, dedupeRuleMatches } = require('./detection/vendorRules');

function extractIdsWithRules(text, rules) {
  const findings = [];
  if (!text || typeof text !== 'string') return findings;

  for (const rule of rules) {
    const matches = [...text.matchAll(rule.re)];
    for (const match of matches) {
      const value = rule.group ? match[rule.group] : match[0];
      if (value) findings.push({ type: rule.type, value });
    }
  }

  return dedupeBy(findings, x => `${x.type}|${x.value}`);
}

function extractIds(text) {
  return extractIdsWithRules(text, ID_RULES);
}

function normalizeUrlCandidate(text) {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/\\\//g, '/')
    .trim()
    .replace(/[),.;]+$/g, '');
}

function parseUrlCandidate(text) {
  const normalized = normalizeUrlCandidate(text);
  if (!normalized) return null;

  try {
    return new URL(normalized.startsWith('//') ? `https:${normalized}` : normalized);
  } catch {
    return null;
  }
}

function hostMatchesName(hostname, expectedHost) {
  return hostname === expectedHost || hostname.endsWith(`.${expectedHost}`);
}

function scopeMatchesUrl(scope, url) {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  const hostMatch = (scope.urlHosts || []).some(host => hostMatchesName(hostname, host));
  const pathMatch =
    !scope.urlPathPatterns?.length ||
    scope.urlPathPatterns.some(pattern => pattern.test(pathname));

  return hostMatch && pathMatch;
}

function extractScopedIdsForUrlText(text, url) {
  if (!url) return [];

  const findings = [];
  for (const scope of VENDOR_SCOPED_ID_RULES) {
    if (!scopeMatchesUrl(scope, url)) continue;
    findings.push(...extractIdsWithRules(text, scope.idExtractors || []));
  }

  return dedupeBy(findings, x => `${x.type}|${x.value}`);
}

function extractIdsFromUrl(text) {
  if (!text || typeof text !== 'string') return [];

  const normalized = normalizeUrlCandidate(text);
  const url = parseUrlCandidate(normalized);
  return dedupeBy(
    [
      ...extractIds(normalized),
      ...extractScopedIdsForUrlText(normalized, url),
    ],
    x => `${x.type}|${x.value}`
  );
}

function extractUrlCandidates(text) {
  const input = normalizeUrlCandidate(text);
  if (!input) return [];

  const candidates = new Set();
  const urlPattern = /(?:https?:)?\/\/[^\s"'<>`]+/gi;
  const matches = input.matchAll(urlPattern);

  for (const match of matches) {
    candidates.add(normalizeUrlCandidate(match[0]));
  }

  return [...candidates];
}

function extractIdsFromTextBlock(text, options = {}) {
  const input = text || '';
  const findings = [...extractIds(input)];

  const patterns = [
    {
      type: 'GA4 Measurement ID',
      re: /gtag\s*\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]+)['"]\s*\)/gi,
    },
    {
      type: 'Google Ads ID',
      re: /gtag\s*\(\s*['"]config['"]\s*,\s*['"](AW-\d+)['"]\s*\)/gi,
    },
    {
      type: 'GTM Container ID',
      re: /['"](GTM-[A-Z0-9]+)['"]/gi,
    },
    {
      type: 'GA4 Measurement ID',
      re: /['"](G-[A-Z0-9]{6,})['"]/g,
    },
    {
      type: 'Google Ads ID',
      re: /['"](AW-\d+)['"]/gi,
    },
    {
      type: 'DoubleClick Advertiser ID',
      re: /['"](DC-\d+)['"]/gi,
    },
    {
      type: 'Facebook Pixel ID',
      re: /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{5,})['"]\s*\)/gi,
    },
    {
      type: 'TikTok Pixel ID',
      re: /ttq\s*\.\s*load\s*\(\s*['"]([A-Za-z0-9]{8,})['"]\s*\)/gi,
    },
  ];

  for (const rule of patterns) {
    const matches = [...input.matchAll(rule.re)];
    for (const match of matches) {
      if (match[1]) findings.push({ type: rule.type, value: match[1] });
    }
  }

  const sourceUrl = parseUrlCandidate(options.sourceUrl);
  if (sourceUrl) {
    findings.push(...extractScopedIdsForUrlText(input, sourceUrl));
  }

  for (const urlText of extractUrlCandidates(input)) {
    findings.push(...extractIdsFromUrl(urlText));
  }

  return dedupeBy(findings, x => `${x.type}|${x.value}`);
}

function hostMatches(hostname, pattern) {
  return pattern.test(hostname);
}

function hasIdType(ids, typePrefix) {
  return ids.some(x => x.type.startsWith(typePrefix));
}

function detectVendorFromUrl(text, options = {}) {
  if (!text || typeof text !== 'string') return [];

  let url;
  try {
    url = new URL(text);
  } catch {
    return [];
  }

  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  const search = url.search.toLowerCase();
  const full = `${hostname}${pathname}${search}`;
  const ids = extractIdsFromUrl(text);

  const vendors = dedupeRuleMatches(evaluateVendorRules(text, options))
    .map(rule => ({ name: rule.name, category: rule.category }));
  const push = (name, category) => vendors.push({ name, category });

  // Google Ads / DoubleClick
  if (
    hostMatches(hostname, /(^|\.)doubleclick\.net$/) ||
    hostMatches(hostname, /(^|\.)googleadservices\.com$/) ||
    hostMatches(hostname, /(^|\.)googlesyndication\.com$/) ||
    (
      hostMatches(hostname, /(^|\.)googletagmanager\.com$/) &&
      pathname === '/gtag/js' &&
      (
        hasIdType(ids, 'Google Ads ID') ||
        search.includes('id=aw-')
      )
    ) ||
    hasIdType(ids, 'Google Ads ID') ||
    pathname.includes('/pagead/') ||
    pathname.includes('/viewthroughconversion/') ||
    pathname.includes('/conversion/') ||
    pathname.includes('/1p-conversion/') ||
    pathname.includes('/ddm/') ||
    pathname.includes('/activityi')
  ) {
    push('Google Ads / DoubleClick', 'media_pixel');
  }

  // Microsoft Ads
  if (hostMatches(hostname, /(^|\.)bat\.bing\.com$/)) {
    push('Microsoft Ads', 'media_pixel');
  }

  // LinkedIn
  if (
    hostMatches(hostname, /(^|\.)px\.ads\.linkedin\.com$/) ||
    hostMatches(hostname, /(^|\.)snap\.licdn\.com$/)
  ) {
    push('LinkedIn Insight', 'media_pixel');
  }

  // Pinterest
  if (hostMatches(hostname, /(^|\.)ct\.pinterest\.com$/)) {
    push('Pinterest Tag', 'media_pixel');
  }

  // The Trade Desk
  if (
    hostMatches(hostname, /(^|\.)adsrvr\.org$/) ||
    hasIdType(ids, 'The Trade Desk Advertiser ID')
  ) {
    push('The Trade Desk', 'media_pixel');
  }

  // Consent
  if (full.includes('onetrust') || full.includes('cookielaw')) {
    push('OneTrust', 'consent');
  }

  if (full.includes('cookiebot')) {
    push('Cookiebot', 'consent');
  }

  if (full.includes('usercentrics')) {
    push('Usercentrics', 'consent');
  }

  if (full.includes('trustarc')) {
    push('TrustArc', 'consent');
  }

  // Segment
  if (
    hostMatches(hostname, /(^|\.)segment\.com$/) ||
    hostMatches(hostname, /(^|\.)segment\.io$/)
  ) {
    push('Segment', 'customer_data_platform');
  }

  // Tealium
  if (full.includes('tealium')) {
    push('Tealium', 'tag_manager');
  }

  // Adobe Launch
  if (
    hostname === 'assets.adobedtm.com' ||
    full.includes('launch-')
  ) {
    push('Adobe Launch', 'tag_manager');
  }

  // Shopify
  if (
    hostname === 'cdn.shopify.com' ||
    hostMatches(hostname, /(^|\.)myshopify\.com$/) ||
    pathname.startsWith('/cdn/shop/') ||
    pathname.includes('/shopifycloud/')
  ) {
    push('Shopify', 'ecommerce');
  }

  // WordPress
  if (
    pathname.includes('/wp-content/') ||
    pathname.includes('/wp-includes/') ||
    pathname.includes('/wp-json/')
  ) {
    push('WordPress', 'cms');
  }

  // Session replay / experimentation
  if (full.includes('hotjar')) {
    push('Hotjar', 'session_replay');
  }

  if (full.includes('fullstory')) {
    push('FullStory', 'session_replay');
  }

  if (full.includes('optimizely')) {
    push('Optimizely', 'experimentation');
  }

  return dedupeBy(vendors, x => `${x.name}|${x.category}`);
}

module.exports = {
  extractIds,
  extractIdsFromUrl,
  extractIdsFromTextBlock,
  detectVendorFromUrl,
};
