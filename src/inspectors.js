const { getHostnameSafe, sameSiteHost } = require('./utils');

function createSafePreviewReplacer() {
  const seen = new WeakSet();

  return (key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;

    if (value && typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }

    return value;
  };
}

function safePreview(value, limit = 3000) {
  try {
    return JSON.stringify(value, createSafePreviewReplacer()).slice(0, limit);
  } catch {
    try {
      return String(value).slice(0, limit);
    } catch {
      return '[unserializable]';
    }
  }
}

async function collectThirdPartyScripts(page, baseUrl) {
  return page.evaluate((origin) => {
    const originHost = new URL(origin).hostname;

    return Array.from(document.querySelectorAll('script[src]'))
      .map(el => el.src)
      .filter(Boolean)
      .map(src => {
        let thirdParty = false;
        try {
          const srcHost = new URL(src).hostname;
          thirdParty = srcHost !== originHost && !srcHost.endsWith(`.${originHost}`);
        } catch {
          thirdParty = false;
        }
        return { src, thirdParty };
      });
  }, baseUrl);
}

async function inspectPageGlobals(page) {
  return page.evaluate(() => {
    const out = {
      title: document.title || '',
      location: window.location.href,
      globals: {},
      ecommerceHints: {},
      cmsHints: {},
      authHints: {},
    };

    const dataLayer = window.dataLayer;
    const adobeDataLayer = window.adobeDataLayer;
    const digitalData = window.digitalData;
    const utag = window.utag;
    const utagData = window.utag_data;
    const nextData = window.__NEXT_DATA__;
    const initialState = window.__INITIAL_STATE__;

    out.globals.dataLayer = {
      present: Array.isArray(dataLayer),
      length: Array.isArray(dataLayer) ? dataLayer.length : null,
      preview: Array.isArray(dataLayer)
        ? safePreview(dataLayer.slice(0, 10))
        : null,
    };

    out.globals.adobeDataLayer = {
      present: Array.isArray(adobeDataLayer),
      length: Array.isArray(adobeDataLayer) ? adobeDataLayer.length : null,
      preview: Array.isArray(adobeDataLayer)
        ? safePreview(adobeDataLayer.slice(0, 10))
        : null,
    };

    out.globals.digitalData = {
      present: typeof digitalData !== 'undefined',
      preview: typeof digitalData !== 'undefined'
        ? safePreview(digitalData)
        : null,
    };

    out.globals.utag = {
      present: typeof utag !== 'undefined',
      keys: typeof utag === 'object' && utag ? Object.keys(utag).slice(0, 25) : [],
    };

    out.globals.utag_data = {
      present: typeof utagData !== 'undefined',
      preview: typeof utagData !== 'undefined'
        ? safePreview(utagData)
        : null,
    };

    out.globals.__NEXT_DATA__ = {
      present: typeof nextData !== 'undefined',
      preview: typeof nextData !== 'undefined'
        ? safePreview(nextData)
        : null,
    };

    out.globals.__INITIAL_STATE__ = {
      present: typeof initialState !== 'undefined',
      preview: typeof initialState !== 'undefined'
        ? safePreview(initialState)
        : null,
    };

    const html = document.documentElement
      ? document.documentElement.outerHTML.slice(0, 100000)
      : '';

    out.ecommerceHints = {
      shopify:
        typeof window.Shopify !== 'undefined' ||
        /https?:\/\/cdn\.shopify\.com/i.test(html) ||
        /https?:\/\/[^"' ]+\.myshopify\.com/i.test(html) ||
        /\/cdn\/shop\//i.test(html) ||
        /shopifycloud/i.test(html),
      cartLinks: Array.from(document.querySelectorAll('a[href], button'))
        .map(x => (x.textContent || '').toLowerCase())
        .filter(Boolean)
        .some(t => t.includes('cart') || t.includes('checkout') || t.includes('shop')),
    };

    out.cmsHints = {
      wordpress: /wp-content|wp-includes|wp-json/i.test(html),
      drupal: /drupal-settings-json|\/sites\/default\//i.test(html),
      webflow: /webflow/i.test(html),
    };

    out.authHints = {
      loginUiPresent: Array.from(document.querySelectorAll('a[href], button, input, form')).some(el => {
        const text = `${el.textContent || ''} ${el.getAttribute?.('value') || ''} ${el.getAttribute?.('action') || ''}`.toLowerCase();
        return /login|log in|sign in|account|register/.test(text);
      }),
    };

    return out;
  });
}

async function inspectPageSourceSignals(page) {
  return page.evaluate(() => {
    const html = document.documentElement ? document.documentElement.outerHTML : '';

    const inlineScripts = Array.from(document.querySelectorAll('script:not([src])'))
      .map(el => el.textContent || '')
      .filter(Boolean);

    const externalScripts = Array.from(document.querySelectorAll('script[src]'))
      .map(el => el.src)
      .filter(Boolean);

    const iframes = Array.from(document.querySelectorAll('iframe[src]'))
      .map(el => el.src)
      .filter(Boolean);

    const noscriptText = Array.from(document.querySelectorAll('noscript'))
      .map(el => el.textContent || '')
      .filter(Boolean);

    const globals = {
      google_tag_manager: typeof window.google_tag_manager !== 'undefined',
      gtag: typeof window.gtag !== 'undefined',
      dataLayerPresent: Array.isArray(window.dataLayer),
      dataLayerPreview: Array.isArray(window.dataLayer)
        ? safePreview(window.dataLayer.slice(0, 10))
        : '',
    };

    return {
      htmlSnippet: html.slice(0, 300000),
      inlineScripts,
      externalScripts,
      iframes,
      noscriptText,
      globals,
    };
  });
}

async function collectCookies(context, currentUrl) {
  try {
    const cookies = await context.cookies();
    const host = getHostnameSafe(currentUrl);

    return cookies
      .filter(cookie => {
        if (!host) return true;
        const domain = (cookie.domain || '').replace(/^\./, '');
        return sameSiteHost(host, domain);
      })
      .map(cookie => ({
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        valuePreview: typeof cookie.value === 'string' ? cookie.value.slice(0, 120) : '',
      }));
  } catch {
    return [];
  }
}

module.exports = {
  collectThirdPartyScripts,
  inspectPageGlobals,
  inspectPageSourceSignals,
  collectCookies,
  safePreview,
};
