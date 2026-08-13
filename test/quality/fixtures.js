const scenarioBodies = {
  'interaction-scroll': `
    <!doctype html><html><head><title>Interaction scroll fixture</title></head><body>
      <div style="height: 1800px"><h1>Lazy content</h1><div id="status"></div></div>
      <script>
        window.addEventListener('scroll', () => { if (window.scrollY > 400 && !window.__fired) {
          window.__fired = true; fetch('https://www.facebook.com/tr?id=987654321012345&ev=ScrollView').catch(() => {});
        }});
      </script>
    </body></html>
  `,
  'interaction-tab': `
    <!doctype html><html><head><title>Interaction tab fixture</title></head><body>
      <div role="tablist"><button role="tab" aria-controls="reviews" aria-selected="true">Overview</button><button role="tab" aria-controls="reviews" aria-selected="false" id="reviews-tab">Reviews</button></div>
      <section id="reviews" hidden>Reviews</section>
      <script>document.querySelector('#reviews-tab').addEventListener('click', () => { document.querySelector('#reviews').hidden = false; window.utag = { view: function() {} }; });</script>
    </body></html>
  `,
  'interaction-accordion': `
    <!doctype html><html><head><title>Interaction accordion fixture</title></head><body>
      <details><summary>Specifications</summary><div>Specs</div></details>
      <script>document.querySelector('summary').addEventListener('click', () => { document.cookie = 'mbox=interaction-target; path=/'; });</script>
    </body></html>
  `,
  'interaction-unsafe-controls': `
    <!doctype html><html><head><title>Interaction unsafe fixture</title></head><body>
      <form id="checkout"><button type="submit">Buy now</button></form><button id="signin">Sign in</button>
      <script>document.querySelector('#checkout').addEventListener('submit', event => { event.preventDefault(); fetch('https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=UNSAFE1').catch(() => {}); }); document.querySelector('#signin').addEventListener('click', () => fetch('https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=UNSAFE2').catch(() => {}));</script>
    </body></html>
  `,
  'interaction-ambiguous-button': `
    <!doctype html><html><head><title>Interaction ambiguous fixture</title></head><body>
      <button id="continue">Continue</button><script>window.__ambiguousClicked = false; document.querySelector('#continue').addEventListener('click', () => { window.__ambiguousClicked = true; });</script>
    </body></html>
  `,
  'spa-network-route': `
    <!doctype html><html><head><title>SPA network fixture</title></head><body>
      <nav><a href="/products" id="products">Products</a><a href="#section">Section</a><a href="https://external.example/products">External</a><a href="/logout">Logout</a><a href="/download.pdf" download>Download</a></nav>
      <section id="app"><h1>Home</h1></section><section id="section">Same page</section>
      <script>
        document.querySelector('#products').addEventListener('click', event => {
          event.preventDefault(); history.pushState({}, '', '/products');
          document.querySelector('#app').innerHTML = '<h1>Products</h1>';
          fetch('https://insight.adsrvr.org/track/route?ttd_pid=SPAROUTE1').catch(() => {});
        });
      </script>
    </body></html>
  `,
  'spa-global-route': `
    <!doctype html><html><head><title>SPA global fixture</title></head><body>
      <a href="/products" id="products">Products</a><a href="/logout">Logout</a><a href="/download.csv" download>Download</a>
      <script>
        document.querySelector('#products').addEventListener('click', event => {
          event.preventDefault(); history.replaceState({}, '', '/products'); window._hsq = [];
        });
      </script>
    </body></html>
  `,
  'spa-cookie-route': `
    <!doctype html><html><head><title>SPA cookie fixture</title></head><body>
      <a href="/products" id="products">Products</a><a href="#section">Details</a><a href="/account">Account</a>
      <script>
        document.querySelector('#products').addEventListener('click', event => {
          event.preventDefault(); history.pushState({}, '', '/products'); document.cookie = 'mbox=spa-target; path=/';
        });
      </script>
    </body></html>
  `,
  'spa-full-navigation': `
    <!doctype html><html><head><title>Full navigation comparison</title></head><body>
      <a href="/products">Products</a><a href="/logout">Logout</a><a href="/download.pdf" download>Download</a>
    </body></html>
  `,
  'consent-network-gated': `
    <!doctype html><html><head><title>Consent network fixture</title></head><body>
      <section role="dialog" aria-label="Cookie consent"><p>We use cookies and tracking to improve this site.</p>
        <button type="button">Decline</button><button type="button">Manage preferences</button>
        <button type="button" id="accept">Accept all cookies</button><a href="/continue">Continue shopping</a>
      </section>
      <script>
        document.querySelector('#accept').addEventListener('click', () => {
          fetch('https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=CONSENTQUALITY1').catch(() => {});
        });
      </script>
    </body></html>
  `,
  'consent-state-gated': `
    <!doctype html><html><head><title>Consent state fixture</title></head><body>
      <div class="onetrust-banner-sdk" role="dialog"><p>Privacy and cookie consent are required.</p>
        <button type="button">Learn more</button><button type="button" id="allow">Allow all</button>
      </div>
      <script>
        document.querySelector('#allow').addEventListener('click', () => {
          document.cookie = 'mbox=consent-target; path=/';
          window._hsq = [];
        });
      </script>
    </body></html>
  `,
  'consent-no-banner': '<!doctype html><html><head><title>No consent</title></head><body><h1>Plain page</h1></body></html>',
  'consent-dangerous-lookalike': `
    <!doctype html><html><head><title>Lookalike consent safety fixture</title></head><body>
      <p>Read our cookie and privacy policy before continuing.</p>
      <main><h1>Checkout</h1><button id="checkout">Continue</button></main>
    </body></html>
  `,
  'delayed-observation-family': `
    <!doctype html><html><head><title>Delayed observation fixture</title></head><body>
      <script>
        fetch('https://www.google-analytics.com/g/collect?tid=G-BASELINEQUALITY').catch(() => {});
        setTimeout(() => {
          fetch('https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=DELAYEDQUALITY1').catch(() => {});
          window._hsq = [];
          document.cookie = 'mbox=delayed-target; path=/';
        }, 5000);
        setTimeout(() => {
          const lateHost = ['www', 'facebook', 'com'].join('.');
          fetch('https://' + lateHost + '/tr?id=' + '123456789012345' + '&ev=Late').catch(() => {});
        }, 30000);
      </script>
    </body></html>
  `,
  'context-scoped-identifier-family': `
    <!doctype html><html><head><title>Context identifier fixture</title>
      <script src="https://www.googletagmanager.com/gtag/js?id=G-CONTEXTQUALITY"></script>
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-CONTEXTQUALITY"></script>
    </head><body><script>
      fetch('https://www.facebook.com/tr?id=123456789012345&ev=PageView').catch(() => {});
      fetch('https://insight.adsrvr.org/track/abc?ttd_pid=CONTEXTQUALITY').catch(() => {});
    </script></body></html>
  `,
  'traditional-direct-script': `
    <!doctype html>
    <html><head><title>Traditional fixture</title>
      <script src="https://www.googletagmanager.com/gtag/js?id=G-QUALITY123"></script>
    </head><body><h1>Traditional page</h1></body></html>
  `,
  'dynamic-runtime-request': `
    <!doctype html>
    <html><head><title>Dynamic fixture</title></head><body>
      <script>
        fetch('https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=DYNAMICQUALITY1')
          .catch(() => {});
      </script>
    </body></html>
  `,
  'embedded-iframe-technology': `
    <!doctype html>
    <html><head><title>Iframe fixture</title></head><body>
      <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-IFRAMEQUALITY"></iframe>
    </body></html>
  `,
  'multiple-evidence-vendors': `
    <!doctype html>
    <html><head><title>Multiple vendor fixture</title>
      <script src="https://www.googletagmanager.com/gtag/js?id=G-MULTIQUALITY"></script>
    </head><body>
      <img alt="" src="https://www.facebook.com/tr?id=123456789012345&ev=PageView">
    </body></html>
  `,
  'negative-lookalike-artifacts': `
    <!doctype html>
    <html><head><title>Negative fixture</title>
      <script src="https://cdn.example.test/library.js?id=NOT-A-GOOGLE-ID"></script>
    </head><body>
      <a href="https://assets.example.test/pixel?pid=not-a-vendor">asset</a>
      <p>GTMX-NOT-A-REAL-CONTAINER and measurement=not-a-vendor</p>
    </body></html>
  `,
  'cookie-vendor-family': `
    <!doctype html><html><head><title>Cookie vendor fixture</title></head>
    <body><h1>Cookie vendor family</h1></body></html>
  `,
  'runtime-global-family': `
    <!doctype html><html><head><title>Runtime global fixture</title>
      <script>
        window._hsq = window._hsq || [];
        window.utag = { view: function() {} };
        window.optimizely = { get: function() {} };
        window.FS = function() {};
        window.hjSettingsOnly = { siteId: 'lookalike' };
        window.utagHelper = function() {};
      </script>
    </head><body><h1>Runtime globals</h1></body></html>
  `,
};

function getScenarioBody(scenario) {
  const body = scenarioBodies[scenario.name];
  if (!body) throw new Error(`No fixture body registered for scenario: ${scenario.name}`);
  return body;
}

function getScenarioHeaders(scenario) {
  if (scenario.name !== 'cookie-vendor-family') return {};
  return {
    'set-cookie': [
      'mbox=target-cookie; Path=/',
      '_hjSessionUser_123=hotjar-cookie; Path=/',
      '__hstc=hubspot-cookie; Path=/',
      '__hssc=hubspot-session; Path=/',
      'fs_uid=fullstory-cookie; Path=/',
      'fs_cid=fullstory-consent; Path=/',
    ],
  };
}

async function prepareScenarioContext(context) {
  await context.route('**/*', route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.hostname === '127.0.0.1') return route.continue();

    return route.fulfill({ status: 204, body: '' });
  });
}

module.exports = {
  getScenarioBody,
  getScenarioHeaders,
  prepareScenarioContext,
};
