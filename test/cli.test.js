const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CliError,
  getHelpText,
  getVersionText,
  parseCliArgs,
} = require('../src/cli');

function argv(...args) {
  return ['node', 'src/scanner.js', ...args];
}

test('help output describes usage, options, defaults, examples, and output', () => {
  const help = getHelpText();
  assert.match(help, /MarTech Scanner/);
  assert.match(help, /MarTech Scanner v0\.3\.0/);
  assert.match(help, /Usage:/);
  assert.match(help, /--domain/);
  assert.match(help, /--headless/);
  assert.match(help, /--timeout/);
  assert.match(help, /--maxPages/);
  assert.match(help, /--enableConsentClick/);
  assert.match(help, /--out/);
  assert.match(help, /--version/);
  assert.match(help, /default: 45000/);
  assert.match(help, /Quick scan:/);
  assert.match(help, /Deeper scan:/);
  assert.match(help, /configured output directory/);
  assert.deepEqual(parseCliArgs(argv('-h')), { help: true });
  assert.deepEqual(parseCliArgs(argv('--help')), { help: true });
});

test('version flags return the package-backed scanner identity', () => {
  assert.equal(getVersionText(), 'MarTech Scanner v0.3.0');
  assert.deepEqual(parseCliArgs(argv('-v')), { version: true });
  assert.deepEqual(parseCliArgs(argv('--version')), { version: true });
});

test('missing domain gives a friendly corrected example', () => {
  assert.throws(
    () => parseCliArgs(argv()),
    error => error instanceof CliError && /domain is required/.test(error.message) && /example\.com/.test(error.message)
  );
});

test('invalid domains give a friendly corrected example', () => {
  assert.throws(() => parseCliArgs(argv('--domain=not a domain')), /valid domain or HTTP\(S\) URL/);
  assert.throws(() => parseCliArgs(argv('--domain=ftp:\/\/example.com')), /HTTP\(S\) URL/);
});

test('invalid maxPages values are rejected', () => {
  assert.throws(() => parseCliArgs(argv('--domain=example.com', '--maxPages=many')), /whole number/);
  assert.throws(() => parseCliArgs(argv('--domain=example.com', '--maxPages=0')), /at least 1/);
});

test('invalid timeout values are rejected', () => {
  assert.throws(() => parseCliArgs(argv('--domain=example.com', '--timeout=slow')), /whole number/);
  assert.throws(() => parseCliArgs(argv('--domain=example.com', '--timeout=999')), /at least 1000/);
});

test('invalid boolean-like values are rejected', () => {
  assert.throws(() => parseCliArgs(argv('--domain=example.com', '--headless=yes')), /true or false/);
  assert.throws(() => parseCliArgs(argv('--domain=example.com', '--enableConsentClick=no')), /true or false/);
});

test('bare boolean options preserve the existing true shorthand', () => {
  const parsed = parseCliArgs(argv('--domain=example.com', '--headless', '--enableConsentClick'));
  assert.equal(parsed.headless, true);
  assert.equal(parsed.enableConsentClick, true);
});

test('valid arguments preserve names and parse to scanner-ready values', () => {
  assert.deepEqual(
    parseCliArgs(argv(
      '--domain=example.com/path',
      '--headless=false',
      '--timeout=60000',
      '--maxPages=8',
      '--enableConsentClick=false',
      '--out=./scan-output'
    )),
    {
      help: false,
      domain: 'https://example.com/path',
      headless: false,
      timeout: 60000,
      maxPages: 8,
      enableConsentClick: false,
      outDir: './scan-output',
    }
  );
});
