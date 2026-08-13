const { sleep } = require('./utils');

const EXPLICIT_ACCEPT_RE = /^(accept(?: all)?(?: cookies?)?|allow all(?: cookies?)?|agree|i agree|consent|got it)$/i;
const AMBIGUOUS_ACCEPT_RE = /^(continue|yes)$/i;
const CONSENT_CONTEXT_RE = /cookie|privacy|consent|tracking|personal(?:ize|ised|ized)|data collection|do not sell/i;
const NEGATIVE_RE = /decline|reject|deny|manage|preferences|settings|learn more|continue shopping|necessary only/i;
const CONTROL_SELECTORS = 'button, [role="button"], input[type="button"]';
const CMP_MARKER_RE = /onetrust|cookiebot|trustarc|didomi|quantcast|sourcepoint|cmp|cookie-banner|cookiebanner/i;

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function readControl(element) {
  return element.evaluate(node => {
    const parts = [node.innerText, node.getAttribute('value'), node.getAttribute('aria-label'), node.getAttribute('title')];
    const ancestors = [];
    let current = node;
    for (let index = 0; current && index < 5; index += 1, current = current.parentElement) {
      ancestors.push({
        text: current.innerText || '',
        role: current.getAttribute('role') || '',
        id: current.id || '',
        className: typeof current.className === 'string' ? current.className : '',
      });
    }
    return { parts, ancestors };
  });
}

function recognizeConsentControl(details) {
  const controlText = normalize(details.parts.join(' '));
  const exactText = normalize(details.parts.find(Boolean) || '');
  const nearbyText = details.ancestors.map(item => item.text).join(' ');
  const markerText = details.ancestors.map(item => `${item.id} ${item.className} ${item.role}`).join(' ');
  const context = CONSENT_CONTEXT_RE.test(nearbyText) || CMP_MARKER_RE.test(markerText);

  if (!controlText || NEGATIVE_RE.test(controlText)) return null;
  const explicit = EXPLICIT_ACCEPT_RE.test(exactText) || EXPLICIT_ACCEPT_RE.test(controlText);
  const ambiguous = AMBIGUOUS_ACCEPT_RE.test(exactText);
  if (!explicit && !(ambiguous && context)) return null;
  if (!context) return null;

  return {
    action: 'accept',
    controlText: exactText.slice(0, 150),
    reason: `${explicit ? 'explicit accept language' : 'ambiguous accept language'} in consent context`,
    context: nearbyText.match(CONSENT_CONTEXT_RE)?.[0] || 'CMP marker',
  };
}

async function findConsentOpportunity(page) {
  const frames = [page, ...page.frames().filter(frame => frame !== page)];
  for (const frame of frames) {
    const controls = await frame.locator(CONTROL_SELECTORS).elementHandles().catch(() => []);
    for (const element of controls) {
      const details = await readControl(element).catch(() => null);
      const decision = details && recognizeConsentControl(details);
      if (decision) return { ...decision, element, frameUrl: frame.url() };
    }
  }
  return null;
}

async function acceptConsent(page, options = {}) {
  const opportunity = await findConsentOpportunity(page);
  if (!opportunity) return { detected: false, attempted: false, success: false, reason: 'no likely consent control' };

  const result = {
    detected: true,
    attempted: true,
    success: false,
    action: opportunity.action,
    controlText: opportunity.controlText,
    reason: opportunity.reason,
    context: opportunity.context,
    frameUrl: opportunity.frameUrl,
    failure: null,
  };

  try {
    await opportunity.element.scrollIntoViewIfNeeded().catch(() => {});
    await opportunity.element.click({ timeout: options.clickTimeoutMs || 2000 });
    result.success = true;
    await sleep(options.postClickSettleMs || 150);
  } catch (error) {
    result.failure = String(error.message || error).slice(0, 300);
  }
  return result;
}

module.exports = { acceptConsent, findConsentOpportunity, recognizeConsentControl, CONTROL_SELECTORS };
