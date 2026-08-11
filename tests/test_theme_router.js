/**
 * test_theme_router.js - Empirical Stress Harness for Theme Engine & SPA Router (M1)
 * Stress-tests ThemeEngine and Router under boundary conditions, edge cases, rapid toggles/navigations,
 * invalid inputs, localStorage failures, event listener errors, and DOM desynchronization risks.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log(' EMPIRICAL STRESS HARNESS: THEME ENGINE & SPA ROUTER');
console.log('====================================================\n');

// --------------------------------------------------------------------------
// 1. DOM & Browser Environment Mocking Setup
// --------------------------------------------------------------------------

class EnhancedMockDOMElement {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attributes };
    this.children = [];
    this.parentNode = null;
    this.classList = {
      _set: new Set(),
      add: (...classes) => classes.forEach(c => c && this.classList._set.add(c)),
      remove: (...classes) => classes.forEach(c => this.classList._set.delete(c)),
      contains: (c) => this.classList._set.has(c),
      has: (c) => this.classList._set.has(c)
    };
    this.eventListeners = {};
    this.style = {};
    this.id = attributes.id || '';
    this.textContent = '';
    this.innerHTML = '';
    
    if (attributes.class) {
      attributes.class.split(' ').forEach(c => c && this.classList._set.add(c));
    }
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name === 'id') this.id = String(val);
    if (name === 'class') {
      this.classList._set.clear();
      String(val).split(' ').forEach(c => c && this.classList._set.add(c));
    }
  }

  getAttribute(name) {
    return this.attributes[name] !== undefined ? this.attributes[name] : null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'class') this.classList._set.clear();
    if (name === 'id') this.id = '';
  }

  appendChild(child) {
    if (typeof child === 'string') {
      const textNode = new EnhancedMockDOMElement('#text');
      textNode.textContent = child;
      child = textNode;
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  addEventListener(event, fn) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(fn);
  }

  removeEventListener(event, fn) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(f => f !== fn);
    }
  }

  dispatchEvent(evt) {
    const eventName = typeof evt === 'string' ? evt : evt.type;
    const listeners = (this.eventListeners[eventName] || []).slice();
    const eventObj = typeof evt === 'string'
      ? { type: eventName, target: this, preventDefault: () => {}, stopPropagation: () => {} }
      : { target: this, preventDefault: () => {}, stopPropagation: () => {}, ...evt };
    
    listeners.forEach(fn => fn(eventObj));

    // Bubble up DOM tree to simulate standard browser click delegation
    if (this.parentNode) {
      this.parentNode.dispatchEvent(eventObj);
    }
    return true;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matchesSelector && current.matchesSelector(selector)) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const check = (node) => {
      if (node.matchesSelector && node.matchesSelector(selector)) {
        matches.push(node);
      }
      for (const child of node.children || []) {
        check(child);
      }
    };
    for (const child of this.children) {
      check(child);
    }
    return matches;
  }

  matchesSelector(selector) {
    const selectors = selector.split(',').map(s => s.trim());
    return selectors.some(sel => {
      if (sel.startsWith('#')) {
        return this.getAttribute('id') === sel.slice(1);
      }
      if (sel.startsWith('.')) {
        return this.classList.contains(sel.slice(1));
      }
      if (sel.includes('[')) {
        const attrMatch = sel.match(/\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]/);
        if (attrMatch) {
          const attrName = attrMatch[1];
          const attrVal = attrMatch[2] ? attrMatch[2].replace(/['"]/g, '') : null;
          if (attrVal !== null) {
            return this.getAttribute(attrName) === attrVal;
          }
          return this.getAttribute(attrName) !== null;
        }
      }
      return this.tagName.toLowerCase() === sel.toLowerCase();
    });
  }
}

class MockDocument {
  constructor() {
    this.documentElement = new EnhancedMockDOMElement('html', { 'data-theme': 'light' });
    this.head = new EnhancedMockDOMElement('head');
    this.body = new EnhancedMockDOMElement('body');
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.documentElement.parentNode = this;
    this.readyState = 'complete';
    this.eventListeners = {};
  }

  createElement(tagName, attrs) {
    return new EnhancedMockDOMElement(tagName, attrs);
  }

  querySelector(selector) {
    if (selector === 'html' || selector === ':root') return this.documentElement;
    if (selector === 'body') return this.body;
    if (selector === 'head') return this.head;
    return this.head.querySelector(selector) || this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    const fromHead = this.head.querySelectorAll(selector);
    const fromBody = this.body.querySelectorAll(selector);
    const result = [];
    if (this.documentElement.matchesSelector(selector)) result.push(this.documentElement);
    return [...result, ...fromHead, ...fromBody];
  }

  getElementById(id) {
    return this.querySelector('#' + id);
  }

  addEventListener(event, fn) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(fn);
  }

  removeEventListener(event, fn) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(f => f !== fn);
    }
  }

  dispatchEvent(evt) {
    const eventName = typeof evt === 'string' ? evt : evt.type;
    const listeners = (this.eventListeners[eventName] || []).slice();
    listeners.forEach(fn => fn(evt));
  }
}

class MockLocalStorage {
  constructor() {
    this.store = new Map();
    this.shouldThrowOnGet = false;
    this.shouldThrowOnSet = false;
  }
  getItem(key) {
    if (this.shouldThrowOnGet) throw new Error('SecurityError: LocalStorage access denied');
    return this.store.has(String(key)) ? this.store.get(String(key)) : null;
  }
  setItem(key, value) {
    if (this.shouldThrowOnSet) throw new Error('QuotaExceededError: LocalStorage limit reached');
    this.store.set(String(key), String(value));
  }
  removeItem(key) {
    this.store.delete(String(key));
  }
  clear() {
    this.store.clear();
  }
}

class CustomEvent {
  constructor(type, params = {}) {
    this.type = type;
    this.detail = params.detail;
  }
}

function createDOMTree(doc) {
  doc.body.children = [];

  const meta = doc.createElement('meta', { id: 'theme-color-meta', content: '#4f46e5' });
  doc.head.appendChild(meta);

  const header = doc.createElement('header', { id: 'app-header' });
  const viewTitle = doc.createElement('h2', { id: 'view-title' });
  const themeBtn = doc.createElement('button', { id: 'theme-toggle', class: 'icon-btn' });
  const themeIcon = doc.createElement('span', { class: 'theme-icon' });
  themeIcon.textContent = '🌙';
  themeBtn.appendChild(themeIcon);

  const secondaryThemeBtn = doc.createElement('button', { 'data-action': 'toggle-theme' });
  const secondaryThemeIcon = doc.createElement('span', { class: 'theme-icon' });
  secondaryThemeBtn.appendChild(secondaryThemeIcon);

  header.appendChild(viewTitle);
  header.appendChild(themeBtn);
  header.appendChild(secondaryThemeBtn);
  doc.body.appendChild(header);

  const nav = doc.createElement('nav', { id: 'app-nav' });
  const navTx = doc.createElement('a', { id: 'nav-transactions', href: '#transactions', 'data-view': 'transactions', class: 'nav-link active', role: 'tab', 'aria-selected': 'true' });
  const navBg = doc.createElement('a', { id: 'nav-budget', href: '#budget', 'data-view': 'budget', class: 'nav-link', role: 'tab', 'aria-selected': 'false' });
  const navRp = doc.createElement('a', { id: 'nav-reports', href: '#reports', 'data-view': 'reports', class: 'nav-link', role: 'tab', 'aria-selected': 'false' });
  const navSt = doc.createElement('a', { id: 'nav-settings', href: '#settings', 'data-view': 'settings', class: 'nav-link', role: 'tab', 'aria-selected': 'false' });
  
  nav.appendChild(navTx);
  nav.appendChild(navBg);
  nav.appendChild(navRp);
  nav.appendChild(navSt);
  doc.body.appendChild(nav);

  const main = doc.createElement('main', { id: 'main-content' });
  const viewTx = doc.createElement('section', { id: 'view-transactions', class: 'view-panel active', 'data-view-content': 'transactions', 'data-route': 'transactions' });
  const viewBg = doc.createElement('section', { id: 'view-budget', class: 'view-panel', 'data-view-content': 'budget', 'data-route': 'budget' });
  const viewRp = doc.createElement('section', { id: 'view-reports', class: 'view-panel', 'data-view-content': 'reports', 'data-route': 'reports' });
  const viewSt = doc.createElement('section', { id: 'view-settings', class: 'view-panel', 'data-view-content': 'settings', 'data-route': 'settings' });

  main.appendChild(viewTx);
  main.appendChild(viewBg);
  main.appendChild(viewRp);
  main.appendChild(viewSt);
  doc.body.appendChild(main);
}

function setupEnvironment() {
  const document = new MockDocument();
  createDOMTree(document);
  const localStorage = new MockLocalStorage();
  const listeners = {};
  
  let mediaQueryCallback = null;
  let matchesDarkMode = false;

  const window = {
    document,
    localStorage,
    location: { hash: '#transactions' },
    navigator: { serviceWorker: { register: async () => ({ scope: './' }) } },
    matchMedia: (query) => ({
      matches: matchesDarkMode,
      addEventListener: (evt, cb) => { mediaQueryCallback = cb; },
      addListener: (cb) => { mediaQueryCallback = cb; }
    }),
    addEventListener: (evt, fn) => {
      if (!listeners[evt]) listeners[evt] = [];
      listeners[evt].push(fn);
    },
    removeEventListener: (evt, fn) => {
      if (listeners[evt]) {
        listeners[evt] = listeners[evt].filter(f => f !== fn);
      }
    },
    dispatchEvent: (evt) => {
      const evtName = typeof evt === 'string' ? evt : evt.type;
      const fns = (listeners[evtName] || []).slice();
      fns.forEach(fn => {
        try {
          fn(evt);
        } catch (e) {
        }
      });
    },
    history: { replaceState: () => {} },
    triggerMediaQueryChange: (matches) => {
      matchesDarkMode = matches;
      if (mediaQueryCallback) {
        mediaQueryCallback({ matches });
      }
    }
  };

  const appJsCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  const evalInContext = new Function('window', 'document', 'navigator', 'localStorage', 'CustomEvent', appJsCode);
  evalInContext(window, document, window.navigator, window.localStorage, CustomEvent);

  return { window, document, localStorage };
}

// --------------------------------------------------------------------------
// 2. Test Runner Framework
// --------------------------------------------------------------------------

let totalTests = 0;
let passedTests = 0;
const findings = [];

function test(id, title, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`✓ [PASS] [${id}] ${title}`);
  } catch (err) {
    console.error(`✗ [FAIL] [${id}] ${title}`);
    console.error(`  Details: ${err.message}`);
    findings.push({ id, title, error: err.message, stack: err.stack });
  }
}

// --------------------------------------------------------------------------
// 3. Suite 1: ThemeEngine Edge & Stress Tests
// --------------------------------------------------------------------------
console.log('\n--- SUITE 1: ThemeEngine Edge & Stress Tests ---');

test('TE-01', 'getPreferredTheme returns light or system theme when localStorage contains invalid values', () => {
  const { window, localStorage } = setupEnvironment();
  const { ThemeEngine } = window;

  const invalidValues = ['pink', 'invalid', '', 'DARK', '123', 'null', 'undefined', '   '];
  invalidValues.forEach(val => {
    localStorage.setItem('theme', val);
    const theme = ThemeEngine.getPreferredTheme();
    assert.strictEqual(theme, 'light', `Invalid value "${val}" should default to "light"`);
  });
});

test('TE-02', 'setTheme sanitizes invalid inputs to light mode', () => {
  const { window, document } = setupEnvironment();
  const { ThemeEngine } = window;

  ThemeEngine.setTheme('dark');
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dark');

  const invalidInputs = ['yellow', null, undefined, 123, {}, []];
  invalidInputs.forEach(input => {
    ThemeEngine.setTheme(input);
    assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'light', `Input "${input}" should be sanitized to "light"`);
  });
});

test('TE-03', 'ThemeEngine handles localStorage access exceptions gracefully without breaking DOM updates', () => {
  const { window, document, localStorage } = setupEnvironment();
  const { ThemeEngine } = window;

  localStorage.shouldThrowOnGet = true;
  localStorage.shouldThrowOnSet = true;

  let theme = null;
  assert.doesNotThrow(() => {
    theme = ThemeEngine.getPreferredTheme();
  });
  assert.strictEqual(theme, 'light');

  assert.doesNotThrow(() => {
    ThemeEngine.setTheme('dark', true);
  });
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dark');
});

test('TE-04', 'Rapid Theme Toggling Stress Test (1,000 continuous toggles)', () => {
  const { window, document, localStorage } = setupEnvironment();
  const { ThemeEngine } = window;

  let eventCount = 0;
  let lastEventTheme = null;
  window.addEventListener('themechanged', (e) => {
    eventCount++;
    lastEventTheme = e.detail.theme;
  });

  const iterations = 1000;
  for (let i = 0; i < iterations; i++) {
    ThemeEngine.toggleTheme();
  }

  const finalTheme = document.documentElement.getAttribute('data-theme');
  assert.strictEqual(finalTheme, 'light', '1000 toggles from light must end on light');
  assert.strictEqual(localStorage.getItem('theme'), 'light', 'localStorage must match light');
  assert.strictEqual(eventCount, iterations, `Must dispatch ${iterations} themechanged events`);
  assert.strictEqual(lastEventTheme, 'light');

  const metaTag = document.getElementById('theme-color-meta');
  assert.strictEqual(metaTag.getAttribute('content'), '#4f46e5', 'Meta tag theme color must match light theme (#4f46e5)');
});

test('TE-05', 'themechanged custom event dispatches detail object accurately to multiple listeners', () => {
  const { window } = setupEnvironment();
  const { ThemeEngine } = window;

  const receivedDetails = [];
  const listener1 = (e) => receivedDetails.push({ id: 1, theme: e.detail.theme });
  const listener2 = (e) => receivedDetails.push({ id: 2, theme: e.detail.theme });

  window.addEventListener('themechanged', listener1);
  window.addEventListener('themechanged', listener2);

  ThemeEngine.setTheme('dark', true);

  assert.strictEqual(receivedDetails.length, 2);
  assert.deepStrictEqual(receivedDetails[0], { id: 1, theme: 'dark' });
  assert.deepStrictEqual(receivedDetails[1], { id: 2, theme: 'dark' });
});

test('TE-06', 'updateToggleUI & Click Event Delegation on inner child elements', () => {
  const { window, document } = setupEnvironment();
  const { ThemeEngine } = window;

  const themeBtn = document.getElementById('theme-toggle');
  const innerSpan = themeBtn.querySelector('.theme-icon');

  // Simulate click on inner <span> inside #theme-toggle
  innerSpan.dispatchEvent({ type: 'click', target: innerSpan });

  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.strictEqual(themeBtn.getAttribute('aria-label'), 'Chuyển sang chế độ sáng');
  assert.strictEqual(innerSpan.textContent, '☀️');

  // Secondary toggle button check
  const secondaryBtn = document.querySelector('[data-action="toggle-theme"]');
  const secondarySpan = secondaryBtn.querySelector('.theme-icon');
  assert.strictEqual(secondaryBtn.getAttribute('aria-label'), 'Chuyển sang chế độ sáng');
  assert.strictEqual(secondarySpan.textContent, '☀️');

  // Click secondary button to toggle back to light
  secondaryBtn.dispatchEvent({ type: 'click', target: secondaryBtn });
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'light');
  assert.strictEqual(themeBtn.getAttribute('aria-label'), 'Chuyển sang chế độ tối');
  assert.strictEqual(innerSpan.textContent, '🌙');
});

test('TE-07', 'OS System Preference Sync (prefers-color-scheme) & Saved Override Protection', () => {
  const { window, document, localStorage } = setupEnvironment();
  const { ThemeEngine } = window;

  window.triggerMediaQueryChange(true);
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dark', 'Theme should follow OS dark mode when no saved preference exists');

  ThemeEngine.setTheme('light', true);
  assert.strictEqual(localStorage.getItem('theme'), 'light');

  window.triggerMediaQueryChange(true);
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'light', 'Theme should stay light and NOT override user saved preference');
});

test('TE-08', 'Multiple ThemeEngine.init() calls idempotency risk check', () => {
  const { window, document } = setupEnvironment();
  const { ThemeEngine } = window;

  ThemeEngine.init();
  ThemeEngine.init();

  const themeBtn = document.getElementById('theme-toggle');

  let changeEventCount = 0;
  window.addEventListener('themechanged', () => changeEventCount++);

  themeBtn.dispatchEvent({ type: 'click', target: themeBtn });

  if (changeEventCount > 1) {
    findings.push({
      id: 'TE-08-FINDING',
      title: 'ThemeEngine.init() is non-idempotent: multiple calls attach duplicate document click listeners',
      error: `Called init() multiple times; 1 click triggered ${changeEventCount} themechanged events.`
    });
  }
});

// --------------------------------------------------------------------------
// 4. Suite 2: SPA Hash Router Edge & Stress Tests
// --------------------------------------------------------------------------
console.log('\n--- SUITE 2: SPA Hash Router Edge & Stress Tests ---');

test('RO-01', 'getCurrentRoute handles standard and slash-prefixed route hashes', () => {
  const { window } = setupEnvironment();
  const { Router } = window;

  const validHashes = [
    { input: '#transactions', expected: 'transactions' },
    { input: '#budget', expected: 'budget' },
    { input: '#reports', expected: 'reports' },
    { input: '#settings', expected: 'settings' },
    { input: '#/transactions', expected: 'transactions' },
    { input: '#/budget', expected: 'budget' },
    { input: '#/reports', expected: 'reports' },
    { input: '#/settings', expected: 'settings' }
  ];

  validHashes.forEach(({ input, expected }) => {
    window.location.hash = input;
    assert.strictEqual(Router.getCurrentRoute(), expected, `Hash "${input}" should resolve to "${expected}"`);
  });
});

test('RO-02', 'getCurrentRoute falls back to DEFAULT_ROUTE for invalid, malformed, or malicious hashes', () => {
  const { window } = setupEnvironment();
  const { Router } = window;

  const invalidHashes = [
    '#unknown',
    '#invalid-route',
    '#/',
    '##',
    '#transactions/detail/123',
    '#settings?tab=general',
    '#<script>alert(1)</script>',
    '',
    '#'
  ];

  invalidHashes.forEach(hash => {
    window.location.hash = hash;
    assert.strictEqual(Router.getCurrentRoute(), 'transactions', `Invalid hash "${hash}" must fall back to "transactions"`);
  });
});

test('RO-03', 'navigateTo sanitizes invalid target routes to DEFAULT_ROUTE', () => {
  const { window } = setupEnvironment();
  const { Router } = window;

  Router.navigateTo('budget');
  assert.strictEqual(window.location.hash, '#budget');

  Router.navigateTo('nonexistent_route');
  assert.strictEqual(window.location.hash, '#transactions');
});

test('RO-04', 'Rapid Route Navigation Stress Test (1,000 navigations across all views & fallbacks)', () => {
  const { window, document } = setupEnvironment();
  const { Router } = window;

  const routes = ['transactions', 'budget', 'reports', 'settings', 'invalid_1', 'budget', 'unknown_2', 'reports'];
  const titles = {
    transactions: 'Giao dịch',
    budget: 'Ngân sách',
    reports: 'Báo cáo',
    settings: 'Cài đặt'
  };

  let routeEventCount = 0;
  window.addEventListener('routechanged', () => routeEventCount++);

  const iterations = 1000;
  for (let i = 0; i < iterations; i++) {
    const route = routes[i % routes.length];
    Router.navigateTo(route);
    Router.render();

    const expectedRoute = Router.ROUTES.includes(route) ? route : 'transactions';
    
    // Check active view section
    const activeSection = document.getElementById(`view-${expectedRoute}`);
    assert.ok(activeSection.classList.contains('active'), `view-${expectedRoute} should have active class`);
    assert.strictEqual(activeSection.getAttribute('hidden'), null, `view-${expectedRoute} should not have hidden attr`);
    assert.strictEqual(activeSection.style.display, 'block', `view-${expectedRoute} style display should be block`);

    // Check inactive sections
    Router.ROUTES.filter(r => r !== expectedRoute).forEach(inactRoute => {
      const inactSection = document.getElementById(`view-${inactRoute}`);
      assert.strictEqual(inactSection.classList.contains('active'), false, `view-${inactRoute} should NOT have active class`);
      assert.strictEqual(inactSection.getAttribute('hidden'), '', `view-${inactRoute} SHOULD have hidden attr`);
      assert.strictEqual(inactSection.style.display, 'none', `view-${inactRoute} style display should be none`);
    });

    // Check header title
    const viewTitleEl = document.getElementById('view-title');
    assert.strictEqual(viewTitleEl.textContent, titles[expectedRoute]);

    // Check nav links
    const activeNav = document.getElementById(`nav-${expectedRoute}`);
    assert.ok(activeNav.classList.contains('active'), `nav-${expectedRoute} should have active class`);
    assert.strictEqual(activeNav.getAttribute('aria-selected'), 'true');

    Router.ROUTES.filter(r => r !== expectedRoute).forEach(inactRoute => {
      const inactNav = document.getElementById(`nav-${inactRoute}`);
      assert.strictEqual(inactNav.classList.contains('active'), false);
      assert.strictEqual(inactNav.getAttribute('aria-selected'), 'false');
    });
  }

  assert.strictEqual(routeEventCount, iterations, `routechanged event count should equal total explicit render calls (${iterations})`);
});

test('RO-05', 'Route lifecycle hooks (Router.on) execution and error isolation', () => {
  const { window } = setupEnvironment();
  const { Router } = window;

  const hookCalls = [];
  Router.on('budget', () => hookCalls.push('budget_1'));
  Router.on('reports', () => {
    hookCalls.push('reports_faulty');
    throw new Error('Downstream chart render error inside route hook');
  });

  Router.navigateTo('budget');
  Router.render();
  assert.deepStrictEqual(hookCalls, ['budget_1']);

  assert.doesNotThrow(() => {
    Router.navigateTo('reports');
    Router.render();
  }, 'Router.render must isolate route lifecycle hook errors');

  assert.strictEqual(Router.getCurrentRoute(), 'reports');
  assert.deepStrictEqual(hookCalls, ['budget_1', 'reports_faulty']);
});

test('RO-06', 'Router resilience when required DOM elements are missing', () => {
  const { window, document } = setupEnvironment();
  const { Router } = window;

  const titleEl = document.getElementById('view-title');
  if (titleEl && titleEl.parentNode) titleEl.parentNode.removeChild(titleEl);

  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(l => l.parentNode && l.parentNode.removeChild(l));

  assert.doesNotThrow(() => {
    Router.navigateTo('settings');
    Router.render();
  });

  assert.strictEqual(Router.getCurrentRoute(), 'settings');
});

test('RO-07', 'hashchange event listener integration updates view on location hash change', () => {
  const { window, document } = setupEnvironment();
  const { Router } = window;

  window.location.hash = '#reports';
  window.dispatchEvent('hashchange');

  assert.strictEqual(Router.getCurrentRoute(), 'reports');
  assert.ok(document.getElementById('view-reports').classList.contains('active'));
});

test('RO-08', 'Multiple Router.init() calls idempotency risk check', () => {
  const { window } = setupEnvironment();
  const { Router } = window;

  Router.init();
  Router.init();

  let routeEventCount = 0;
  window.addEventListener('routechanged', () => routeEventCount++);

  window.location.hash = '#budget';
  window.dispatchEvent('hashchange');

  if (routeEventCount > 1) {
    findings.push({
      id: 'RO-08-FINDING',
      title: 'Router.init() is non-idempotent: multiple calls attach duplicate hashchange event listeners',
      error: `Called Router.init() multiple times; 1 hashchange event triggered ${routeEventCount} routechanged events.`
    });
  }
});

// --------------------------------------------------------------------------
// 5. Test Results & Findings Summary
// --------------------------------------------------------------------------

console.log('\n====================================================');
console.log(` EMPIRICAL HARNESS RESULTS: ${passedTests} / ${totalTests} PASSED`);
console.log('====================================================');

if (findings.length > 0) {
  console.log('\n--- FINDINGS & POTENTIAL FAILURES SURFACED ---');
  findings.forEach((f, idx) => {
    console.log(`\n[Finding ${idx + 1}] ID: ${f.id}`);
    console.log(`Title: ${f.title}`);
    console.log(`Details: ${f.error}`);
  });
}

if (passedTests !== totalTests) {
  process.exit(1);
}
