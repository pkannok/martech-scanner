const { dedupeBy } = require('../utils');

// Declarative rules own URL-based detection for these vendors. The remaining
// detector branches are intentionally left as specialized/legacy behavior.
const VENDOR_RULES = Object.freeze([
  {
    id: 'google-tag-manager',
    name: 'Google Tag Manager',
    category: 'tag_manager',
    signals: {
      request: [{ hosts: ['googletagmanager.com'], paths: [/^\/gtm\.js$/, /^\/gtm\//, /^\/ns\.html$/] }],
      script: [{ hosts: ['googletagmanager.com'], paths: [/^\/gtm\.js$/, /^\/gtm\//] }],
      iframe: [{ hosts: ['googletagmanager.com'], paths: [/^\/ns\.html$/] }],
    },
  },
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    category: 'analytics',
    signals: {
      request: [
        { hosts: ['google-analytics.com', 'analytics.google.com'], paths: [/\/collect/, /\/g\/collect/, /\/mp\/collect/] },
      ],
      script: [{ hosts: ['googletagmanager.com'], paths: [/^\/gtag\/js$/], search: [/[?&]id=g-[a-z0-9]+/i] }],
    },
  },
  {
    id: 'meta-pixel',
    name: 'Meta Pixel',
    category: 'media_pixel',
    signals: {
      request: [{ hosts: ['facebook.com'], paths: [/^\/tr$/] }],
      script: [{ hosts: ['connect.facebook.net'] }],
    },
  },
  {
    id: 'tiktok-pixel',
    name: 'TikTok Pixel',
    category: 'media_pixel',
    signals: {
      request: [{ hosts: ['analytics.tiktok.com', 'business-api.tiktok.com'] }],
      script: [{ hosts: ['analytics.tiktok.com', 'tiktokcdn.com'] }],
    },
  },
  {
    id: 'adobe-experience-cloud',
    name: 'Adobe Analytics / Experience Cloud',
    category: 'analytics',
    signals: {
      request: [{ hosts: ['omtrdc.net', '2o7.net', 'demdex.net', 'adobedc.net', 'everesttech.net'] }],
      script: [{ hosts: ['omtrdc.net', '2o7.net', 'demdex.net', 'adobedc.net', 'everesttech.net'] }],
    },
  },
]);

const RULE_BY_NAME = new Map(VENDOR_RULES.map(rule => [rule.name, rule]));

function hostMatches(hostname, expectedHost) {
  return hostname === expectedHost || hostname.endsWith(`.${expectedHost}`);
}

function ruleSignalMatches(signal, url) {
  if (!signal.hosts?.some(host => hostMatches(url.hostname, host))) return false;
  if (signal.paths?.length && !signal.paths.some(pattern => pattern.test(url.pathname))) return false;
  if (signal.search?.length && !signal.search.some(pattern => pattern.test(url.search))) return false;
  return true;
}

function evaluateVendorRules(text, options = {}) {
  if (!text || typeof text !== 'string') return [];

  let url;
  try {
    url = new URL(text);
  } catch {
    return [];
  }

  const source = options.source || null;
  return VENDOR_RULES.filter(rule => {
    const signalGroups = source ? rule.signals?.[source] || [] : Object.values(rule.signals || {}).flat();
    return signalGroups.some(signal => ruleSignalMatches(signal, url));
  });
}

function vendorIdForName(name) {
  return RULE_BY_NAME.get(name)?.id || null;
}

function vendorNameForId(id) {
  return VENDOR_RULES.find(rule => rule.id === id)?.name || null;
}

function dedupeRuleMatches(matches) {
  return dedupeBy(matches, rule => rule.id);
}

module.exports = {
  VENDOR_RULES,
  evaluateVendorRules,
  dedupeRuleMatches,
  vendorIdForName,
  vendorNameForId,
};
