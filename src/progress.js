const { nowIso } = require('./utils');

const PROGRESS_EVENT_TYPES = Object.freeze([
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

function formatProgressEvent(event) {
  switch (event.type) {
    case 'scan:start':
      return `Starting scan for ${event.domain}`;
    case 'scan:error':
      return `Scan failed: ${event.error}`;
    case 'scan:config':
    case 'scan:phase':
      return event.message || event.type;
    case 'discovery:start':
      return 'Discovering pages...';
    case 'discovery:complete':
      return `Discovered ${event.discoveredCount} candidate URL(s); scanning ${event.queuedCount} unique page(s).${event.duplicateCount ? ` Skipped ${event.duplicateCount} duplicate URL variant(s).` : ''}`;
    case 'page:start':
      return `Scanning page ${event.index}/${event.total}: ${event.url}`;
    case 'page:retry':
      return `Retrying thin page with richer interactions: ${event.url}`;
    case 'page:failed':
      return `Page failed: ${event.url}${event.error ? `, error=${event.error}` : ''}`;
    case 'page:complete': {
      const retryNote = event.retried ? ', retried=true' : '';
      const errorNote = event.error ? `, error=${event.error}` : '';
      return `Finished page ${event.index}/${event.total}: status=${event.status}, http=${event.statusCode ?? 'n/a'}, vendors=${event.vendorCount}, ids=${event.idCount}, network=${event.networkCount}, scripts=${event.scriptCount}${retryNote}${errorNote}`;
    }
    case 'scan:writing':
      return 'Writing report files...';
    case 'scan:complete':
      return `Scan complete: pages=${event.pageCount}, vendors=${event.vendorCount}, ids=${event.idCount}`;
    default:
      return event.message || event.type;
  }
}

function createProgressEmitter({ logger = null, onProgress = null } = {}) {
  return event => {
    const enrichedEvent = {
      ...event,
      timestamp: event.timestamp || nowIso(),
    };

    if (typeof onProgress === 'function') {
      onProgress(enrichedEvent);
    }

    if (logger && typeof logger.log === 'function') {
      logger.log(`[${enrichedEvent.timestamp}] ${formatProgressEvent(enrichedEvent)}`);
    }

    return enrichedEvent;
  };
}

module.exports = {
  PROGRESS_EVENT_TYPES,
  formatProgressEvent,
  createProgressEmitter,
};
