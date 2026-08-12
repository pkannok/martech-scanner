const scenarioBodies = {
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
