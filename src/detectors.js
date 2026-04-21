const { ID_RULES } = require('./config');
const { dedupeBy } = require('./utils');

function extractIds(text) {
  const findings = [];
  if (!text || typeof text !== 'string') return findings;

  for (const rule of ID_RULES) {
    const matches = [...text.matchAll(rule.re)];
    for (const match of matches) {
      const value = rule.group ? match[rule.group] : match[0];
      if (value) findings.push({ type: rule.type, value });
    }
  }

  return dedupeBy(findings, x => `${x.type}|${x.value}`);
}

function extractIdsFromTextBlock(text) {
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
    {
      type: 'The Trade Desk Advertiser ID',
      re: /(?:advertiser_id|ttd_pid)\s*[:=]\s*['"]?([A-Za-z0-9_-]{3,})['"]?/gi,
    },
  ];

  for (const rule of patterns) {
    const matches = [...input.matchAll(rule.re)];
    for (const match of matches) {
      if (match[1]) findings.push({ type: rule.type, value: match[1] });
    }
  }

  return dedupeBy(findings, x => `${x.type}|${x.value}`);
}

function hostMatches(hostname, pattern) {
  return pattern.test(hostname);
}

function hasIdType(ids, typePrefix) {
  return ids.some(x => x.type.startsWith(typePrefix));
}

function detectVendorFromUrl(text) {
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
  const ids = extractIds(text);

  const vendors = [];
  const push = (name, category) => vendors.push({ name, category });

    // Google Tag Manager
  if (
    hostMatches(hostname, /(^|\.)googletagmanager\.com$/) &&
    (
      pathname === '/gtm.js' ||
      pathname === '/ns.html' ||
      pathname.startsWith('/gtm/') ||
      hasIdType(ids, 'GTM Container ID')
    )
  ) {
    push('Google Tag Manager', 'tag_manager');
  }

  // Google Analytics / GA4
  if (
    hostMatches(hostname, /(^|\.)google-analytics\.com$/) ||
    hostMatches(hostname, /(^|\.)analytics\.google\.com$/) ||
    (
      hostMatches(hostname, /(^|\.)googletagmanager\.com$/) &&
      pathname === '/gtag/js' &&
      (
        hasIdType(ids, 'GA4 Measurement ID') ||
        search.includes('id=g-')
      )
    ) ||
    (
      hostMatches(hostname, /(^|\.)google-analytics\.com$/) &&
      (
        pathname.includes('/g/collect') ||
        pathname.includes('/mp/collect') ||
        pathname.includes('/r/collect') ||
        pathname.includes('/j/collect') ||
        pathname.includes('/collect')
      )
    ) ||
    search.includes('tid=g-')
  ) {
    push('Google Analytics', 'analytics');
  }

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

  // Meta
  if (
    (hostname === 'www.facebook.com' && pathname === '/tr') ||
    hostMatches(hostname, /(^|\.)connect\.facebook\.net$/)
  ) {
    push('Meta Pixel', 'media_pixel');
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

  // TikTok
  if (
    hostMatches(hostname, /(^|\.)analytics\.tiktok\.com$/) ||
    hostMatches(hostname, /(^|\.)business-api\.tiktok\.com$/) ||
    hostMatches(hostname, /(^|\.)tiktok\.com$/) ||
    hostMatches(hostname, /(^|\.)tiktokcdn\.com$/) ||
    hasIdType(ids, 'TikTok Pixel ID')
  ) {
    push('TikTok Pixel', 'media_pixel');
  }

  // Pinterest
  if (hostMatches(hostname, /(^|\.)ct\.pinterest\.com$/)) {
    push('Pinterest Tag', 'media_pixel');
  }

  // Adobe
  if (
    hostMatches(hostname, /(^|\.)omtrdc\.net$/) ||
    hostMatches(hostname, /(^|\.)2o7\.net$/) ||
    hostMatches(hostname, /(^|\.)demdex\.net$/) ||
    hostMatches(hostname, /(^|\.)adobedc\.net$/) ||
    hostMatches(hostname, /(^|\.)everesttech\.net$/)
  ) {
    push('Adobe Analytics / Experience Cloud', 'analytics');
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
  extractIdsFromTextBlock,
  detectVendorFromUrl,
};
