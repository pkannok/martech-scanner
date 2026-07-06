const {
  DEFAULT_TIMEOUT,
  DEFAULT_OUT_DIR,
  DEFAULT_MAX_PAGES,
} = require('./config');
const { normalizeDomain } = require('./utils');
const { SCANNER_NAME, SCANNER_VERSION } = require('./version');

const MIN_TIMEOUT = 1000;
const SUPPORTED_OPTIONS = new Set([
  'domain',
  'headless',
  'timeout',
  'maxPages',
  'enableConsentClick',
  'out',
]);

class CliError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CliError';
  }
}

function getVersionText() {
  return `${SCANNER_NAME} v${SCANNER_VERSION}`;
}

function getHelpText() {
  return `${getVersionText()}

Scans a public website for browser-visible marketing and analytics technology.

Usage:
  node src/scanner.js --domain=https://example.com [options]

Options:
  --domain=<domain-or-url>       Site to scan (required)
  --headless=<true|false>        Run without showing Chromium (default: true)
  --timeout=<milliseconds>       Navigation timeout, minimum ${MIN_TIMEOUT} (default: ${DEFAULT_TIMEOUT})
  --maxPages=<number>            Maximum pages to scan, minimum 1 (default: ${DEFAULT_MAX_PAGES})
  --enableConsentClick=<true|false>
                                Try common consent buttons (default: true)
  --out=<directory>              Output directory (default: ${DEFAULT_OUT_DIR})
  -h, --help                    Show this help message
  -v, --version                 Show the scanner version

Examples:
  Quick scan:   node src/scanner.js --domain=https://example.com --maxPages=1
  Deeper scan:  node src/scanner.js --domain=https://example.com --maxPages=10 --timeout=60000

The JSON report and Markdown summary are written to the configured output directory.`;
}

function parseRawArgs(argv) {
  const args = {};

  for (const arg of argv.slice(2)) {
    if (arg === '-h' || arg === '--help') {
      args.help = true;
      continue;
    }
    if (arg === '-v' || arg === '--version') {
      args.version = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      throw new CliError(
        `I couldn't understand "${arg}". Options must use the --name=value format.\n` +
        'Try: node src/scanner.js --domain=https://example.com'
      );
    }

    const equalsIndex = arg.indexOf('=');
    const key = arg.slice(2, equalsIndex === -1 ? undefined : equalsIndex).trim();
    if (!SUPPORTED_OPTIONS.has(key)) {
      throw new CliError(
        `"--${key}" isn't a supported option.\n` +
        'Run node src/scanner.js --help to see the available options.'
      );
    }
    if (equalsIndex === -1 && (key === 'headless' || key === 'enableConsentClick')) {
      args[key] = true;
      continue;
    }
    if (equalsIndex === -1 || !arg.slice(equalsIndex + 1).trim()) {
      throw new CliError(
        `The --${key} option needs a value.\n` +
        `Try: --${key}=${key === 'domain' ? 'https://example.com' : 'VALUE'}`
      );
    }

    args[key] = arg.slice(equalsIndex + 1).trim();
  }

  return args;
}

function parsePositiveInteger(value, optionName, minimum) {
  if (!/^\d+$/.test(String(value))) {
    throw new CliError(
      `--${optionName} must be a whole number. You entered "${value}".\n` +
      `Try: --${optionName}=${optionName === 'maxPages' ? DEFAULT_MAX_PAGES : DEFAULT_TIMEOUT}`
    );
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new CliError(
      `--${optionName} must be at least ${minimum}. You entered "${value}".\n` +
      `Try: --${optionName}=${optionName === 'maxPages' ? DEFAULT_MAX_PAGES : DEFAULT_TIMEOUT}`
    );
  }
  return parsed;
}

function parseBoolean(value, optionName) {
  if (value === undefined) return true;
  const normalized = String(value).toLowerCase();
  if (normalized !== 'true' && normalized !== 'false') {
    throw new CliError(
      `--${optionName} must be either true or false. You entered "${value}".\n` +
      `Try: --${optionName}=false`
    );
  }
  return normalized === 'true';
}

function validateDomain(value) {
  if (!value) {
    throw new CliError(
      'A domain is required before the scanner can start.\n' +
      'Try: node src/scanner.js --domain=https://example.com'
    );
  }

  let normalized;
  try {
    normalized = normalizeDomain(value);
  } catch {
    throw new CliError(
      `"${value}" doesn't look like a valid domain or HTTP(S) URL.\n` +
      'Try: node src/scanner.js --domain=https://example.com'
    );
  }

  const url = new URL(normalized);
  const validProtocol = url.protocol === 'http:' || url.protocol === 'https:';
  const validHostname = url.hostname === 'localhost' || url.hostname.includes('.') || /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname);
  if (!validProtocol || !validHostname || /\s/.test(value)) {
    throw new CliError(
      `"${value}" doesn't look like a valid domain or HTTP(S) URL.\n` +
      'Try: node src/scanner.js --domain=https://example.com'
    );
  }
  return normalized;
}

function parseCliArgs(argv = process.argv) {
  const raw = parseRawArgs(argv);
  if (raw.help) return { help: true };
  if (raw.version) return { version: true };

  return {
    help: false,
    domain: validateDomain(raw.domain),
    headless: parseBoolean(raw.headless, 'headless'),
    timeout: parsePositiveInteger(raw.timeout ?? DEFAULT_TIMEOUT, 'timeout', MIN_TIMEOUT),
    maxPages: parsePositiveInteger(raw.maxPages ?? DEFAULT_MAX_PAGES, 'maxPages', 1),
    enableConsentClick: parseBoolean(raw.enableConsentClick, 'enableConsentClick'),
    outDir: raw.out || DEFAULT_OUT_DIR,
  };
}

module.exports = {
  MIN_TIMEOUT,
  CliError,
  getHelpText,
  getVersionText,
  parseCliArgs,
};
