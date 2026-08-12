const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { after, before } = require('node:test');
const { chromium } = require('playwright');

const { runScanPass } = require('../src/scanner');
const { evaluateScenario, formatScenarioFailure } = require('./quality/harness');
const { getScenarioBody, prepareScenarioContext } = require('./quality/fixtures');

const scenarios = JSON.parse(fs.readFileSync(path.join(__dirname, 'quality', 'scenarios.json'), 'utf8'));
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
});

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}

function close(server) {
  return new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
}

async function withScenarioServer(scenario, callback) {
  const server = http.createServer((request, response) => {
    if (new URL(request.url, 'http://127.0.0.1').pathname !== scenario.path) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(getScenarioBody(scenario));
  });

  await listen(server);
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}${scenario.path}`;

  try {
    return await callback(url);
  } finally {
    await close(server);
  }
}

for (const scenario of scenarios) {
  test(`quality scenario: ${scenario.name}`, async () => {
    await withScenarioServer(scenario, async url => {
      const report = await runScanPass(
        browser,
        url,
        url,
        5000,
        false,
        { prepareContext: prepareScenarioContext }
      );
      const result = evaluateScenario(scenario, report);

      assert.equal(result.passed, true, formatScenarioFailure(result));
    });
  });
}

test('quality diagnostics identify missed and unexpected vendors', () => {
  const result = evaluateScenario(
    {
      name: 'diagnostic-example',
      architecture: 'traditional',
      expectedVendors: ['Expected Vendor'],
      expectedEvidence: {},
    },
    {
      networkFindings: [{ vendor: { name: 'Unexpected Vendor' } }],
      scriptFindings: [],
      sourceSignals: {},
      pageGlobals: {},
    }
  );

  const message = formatScenarioFailure(result);
  assert.match(message, /Missed:\n  Expected Vendor/);
  assert.match(message, /Unexpected:\n  Unexpected Vendor/);
});

test('quality diagnostics identify missing expected evidence', () => {
  const result = evaluateScenario(
    {
      name: 'evidence-diagnostic-example',
      architecture: 'dynamic',
      expectedVendors: ['Expected Vendor'],
      expectedEvidence: { 'Expected Vendor': ['network'] },
    },
    {
      networkFindings: [],
      scriptFindings: [{ detectedVendors: [{ name: 'Expected Vendor', category: 'analytics' }] }],
      sourceSignals: {},
      pageGlobals: {},
    }
  );

  assert.match(formatScenarioFailure(result), /Evidence gaps:/);
  assert.match(formatScenarioFailure(result), /Expected: network/);
  assert.match(formatScenarioFailure(result), /Observed: script/);
});
