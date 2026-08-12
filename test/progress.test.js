const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PROGRESS_EVENT_TYPES,
  createProgressEmitter,
  formatProgressEvent,
} = require('../src/progress');

test('progress emitter provides a structured event contract and timestamp', () => {
  const events = [];
  const logs = [];
  const emit = createProgressEmitter({
    onProgress: event => events.push(event),
    logger: { log: message => logs.push(message) },
  });

  const event = emit({
    type: 'page:complete',
    index: 1,
    total: 2,
    url: 'https://example.test',
    status: 'ok',
    statusCode: 200,
    vendorCount: 3,
    idCount: 2,
    networkCount: 4,
    scriptCount: 1,
    retried: false,
    error: null,
  });

  assert.equal(events.length, 1);
  assert.equal(events[0], event);
  assert.match(event.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(logs[0], /Finished page 1\/2: status=ok, http=200, vendors=3, ids=2/);
});

test('progress formatting covers scan lifecycle, failure, retry, and completion', () => {
  assert.deepEqual(PROGRESS_EVENT_TYPES, [
    'scan:start',
    'scan:config',
    'scan:phase',
    'scan:error',
    'discovery:start',
    'discovery:complete',
    'page:start',
    'page:retry',
    'page:complete',
    'page:failed',
    'scan:writing',
    'scan:complete',
  ]);

  assert.match(formatProgressEvent({ type: 'scan:start', domain: 'https://example.test' }), /Starting scan/);
  assert.match(formatProgressEvent({ type: 'page:start', index: 1, total: 2, url: 'https://example.test' }), /Scanning page 1\/2/);
  assert.match(formatProgressEvent({ type: 'page:retry', url: 'https://example.test' }), /Retrying thin page/);
  assert.match(formatProgressEvent({ type: 'page:failed', url: 'https://example.test', error: 'timeout' }), /Page failed.*timeout/);
  assert.match(formatProgressEvent({ type: 'scan:complete', pageCount: 2, vendorCount: 3, idCount: 4 }), /pages=2, vendors=3, ids=4/);
});

test('progress callbacks are optional and do not create background state', () => {
  const emit = createProgressEmitter({ logger: false });
  const event = emit({ type: 'scan:writing', jsonPath: 'results.json', mdPath: 'summary.md' });

  assert.equal(event.type, 'scan:writing');
  assert.equal(event.jsonPath, 'results.json');
});
