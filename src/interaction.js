const { sleep } = require('./utils');

const UNSAFE_RE = /submit|buy|purchase|checkout|cart|payment|billing|sign in|signin|login|logout|log out|account|register|delete|remove|unsubscribe|download|upload|password|permission|location|camera|microphone|contact|apply/i;

function safeLabel(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 150);
}

function classifyControl(details) {
  const label = safeLabel(details.label);
  const context = `${label} ${details.id || ''} ${details.className || ''}`;
  if (details.disabled || details.type === 'submit' || details.href || UNSAFE_RE.test(context)) return null;
  if (details.ariaSelected === 'true' || details.ariaExpanded === 'true') return null;
  if (String(details.role).toLowerCase() === 'tab' && details.ariaControls) return { type: 'tab', label, reason: 'semantic tab with controlled panel' };
  if (details.tagName === 'SUMMARY') return { type: 'accordion', label, reason: 'details/summary disclosure control' };
  if (details.ariaExpanded === 'false' && details.ariaControls) return { type: 'accordion', label, reason: 'collapsed control with aria-controls' };
  if ((String(details.role).toLowerCase() === 'button' || details.tagName === 'BUTTON') && /show more|view details|read more|view specifications|view specs/i.test(label)) {
    return { type: 'reveal', label, reason: 'explicit content-reveal label' };
  }
  return null;
}

async function findSafeInteraction(page) {
  const handles = await page.locator('button, [role="tab"], [role="button"], summary').elementHandles().catch(() => []);
  for (const element of handles) {
    const details = await element.evaluate(node => ({
      tagName: node.tagName,
      role: node.getAttribute('role') || '',
      label: node.innerText || node.getAttribute('aria-label') || node.getAttribute('title') || '',
      id: node.id || '',
      className: typeof node.className === 'string' ? node.className : '',
      type: node.getAttribute('type') || '',
      href: node.getAttribute('href') || '',
      disabled: node.disabled === true || node.getAttribute('aria-disabled') === 'true',
      ariaControls: node.getAttribute('aria-controls') || '',
      ariaSelected: node.getAttribute('aria-selected'),
      ariaExpanded: node.getAttribute('aria-expanded'),
    })).catch(() => null);
    const classification = details && classifyControl(details);
    if (!classification || !(await element.isVisible().catch(() => false))) continue;
    return { element, ...classification };
  }
  return null;
}

async function performBoundedScroll(page) {
  const state = await page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement || document.body;
    const maxScroll = root ? Math.max(0, root.scrollHeight - window.innerHeight) : 0;
    return { maxScroll, viewport: window.innerHeight, before: window.scrollY };
  }).catch(() => ({ maxScroll: 0, viewport: 960, before: 0 }));
  if (state.maxScroll < Math.max(120, state.viewport) * 0.35) return { attempted: false, success: false, type: 'scroll', reason: 'page has no meaningful lower viewport' };
  const target = Math.min(state.maxScroll, Math.max(state.before + 1, Math.round(state.maxScroll * 0.75)));
  await page.evaluate(value => window.scrollTo({ top: value, behavior: 'auto' }), target).catch(() => {});
  await sleep(100);
  const after = await page.evaluate(() => window.scrollY).catch(() => state.before);
  return { attempted: true, success: after !== state.before, type: 'scroll', before: state.before, after, target };
}

async function performSafeInteraction(page, options = {}) {
  const result = { attempted: false, success: false, type: null, label: null, reason: null, failure: null, actions: [] };
  const scroll = await performBoundedScroll(page);
  result.actions.push(scroll);
  if (scroll.success) {
    result.attempted = true;
    result.success = true;
    result.type = 'scroll';
  }
  const candidate = await findSafeInteraction(page);
  if (!candidate) {
    result.reason = result.success ? 'no safe semantic control after scroll' : scroll.reason;
    return result;
  }
  result.attempted = true;
  result.type = candidate.type;
  result.label = candidate.label;
  result.reason = candidate.reason;
  const beforeUrl = page.url();
  try {
    await candidate.element.scrollIntoViewIfNeeded().catch(() => {});
    await candidate.element.click({ timeout: options.clickTimeoutMs || 2000, noWaitAfter: true });
    await sleep(100);
    if (page.url() !== beforeUrl) {
      result.failure = 'unexpected navigation during safe interaction';
      return result;
    }
    result.success = true;
    result.actions.push({ type: candidate.type, label: candidate.label, success: true });
  } catch (error) {
    result.failure = String(error.message || error).slice(0, 300);
  }
  return result;
}

module.exports = { classifyControl, findSafeInteraction, performBoundedScroll, performSafeInteraction };
