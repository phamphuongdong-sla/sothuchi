const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Load mock environment classes from test-utils.js
const { MockLocalStorage, MockDocument, MockDOMElement } = require('./test-utils.js');

console.log('====================================================');
console.log(' M1 RUNTIME BEHAVIORAL SUITE');
console.log('====================================================\n');

// Build mock document and window
const document = new MockDocument();
document.documentElement = new MockDOMElement('html');

const header = new MockDOMElement('header', { id: 'app-header' });
const viewTitle = new MockDOMElement('h2', { id: 'view-title' });
const syncStatus = new MockDOMElement('div', { id: 'sync-status' });
const themeToggle = new MockDOMElement('button', { id: 'theme-toggle' });
const themeIcon = new MockDOMElement('span', { class: 'theme-icon' });
themeToggle.appendChild(themeIcon);

header.appendChild(viewTitle);
header.appendChild(syncStatus);
header.appendChild(themeToggle);
document.body.appendChild(header);

const nav = new MockDOMElement('nav', { id: 'app-nav' });
const navTx = new MockDOMElement('a', { id: 'nav-transactions', href: '#transactions', 'data-view': 'transactions' });
const navBg = new MockDOMElement('a', { id: 'nav-budget', href: '#budget', 'data-view': 'budget' });
const navRp = new MockDOMElement('a', { id: 'nav-reports', href: '#reports', 'data-view': 'reports' });
const navSt = new MockDOMElement('a', { id: 'nav-settings', href: '#settings', 'data-view': 'settings' });
nav.appendChild(navTx);
nav.appendChild(navBg);
nav.appendChild(navRp);
nav.appendChild(navSt);
document.body.appendChild(nav);

const main = new MockDOMElement('main', { id: 'main-content' });
const viewTx = new MockDOMElement('section', { id: 'view-transactions', class: 'view-panel active', 'data-view-content': 'transactions', 'data-route': 'transactions' });
const viewBg = new MockDOMElement('section', { id: 'view-budget', class: 'view-panel', 'data-view-content': 'budget', 'data-route': 'budget' });
const viewRp = new MockDOMElement('section', { id: 'view-reports', class: 'view-panel', 'data-view-content': 'reports', 'data-route': 'reports' });
const viewSt = new MockDOMElement('section', { id: 'view-settings', class: 'view-panel', 'data-view-content': 'settings', 'data-route': 'settings' });
main.appendChild(viewTx);
main.appendChild(viewBg);
main.appendChild(viewRp);
main.appendChild(viewSt);
document.body.appendChild(main);

const localStorage = new MockLocalStorage();
const listeners = {};

const window = {
  document,
  localStorage,
  location: { hash: '#transactions' },
  navigator: { serviceWorker: { register: async () => ({ scope: './' }) } },
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  addEventListener: (evt, fn) => {
    if (!listeners[evt]) listeners[evt] = [];
    listeners[evt].push(fn);
  },
  dispatchEvent: (evt) => {
    const evtName = typeof evt === 'string' ? evt : evt.type;
    const fns = listeners[evtName] || [];
    fns.forEach(fn => fn(evt));
  }
};

// Load app.js into window context
const appJsCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const evalInContext = new Function('window', 'document', 'navigator', 'localStorage', 'CustomEvent', appJsCode);

class CustomEvent {
  constructor(type, params = {}) {
    this.type = type;
    this.detail = params.detail;
  }
}

evalInContext(window, document, window.navigator, window.localStorage, CustomEvent);

const { ThemeEngine, Router, App } = window;

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(`  Error: ${err.stack || err.message}`);
  }
}

// 1. Theme Engine Default Theme Test
runTest('ThemeEngine initializes with light theme by default', () => {
  ThemeEngine.init();
  const themeAttr = document.documentElement.getAttribute('data-theme');
  assert.strictEqual(themeAttr, 'light');
});

// 2. Theme Switching & Persistence Test
runTest('ThemeEngine toggles to dark mode and dispatches themechanged event', () => {
  let eventDispatched = false;
  let receivedTheme = '';
  
  window.addEventListener('themechanged', (e) => {
    eventDispatched = true;
    receivedTheme = e.detail ? e.detail.theme : null;
  });

  ThemeEngine.toggleTheme();

  const themeAttr = document.documentElement.getAttribute('data-theme');
  assert.strictEqual(themeAttr, 'dark');
  assert.strictEqual(window.localStorage.getItem('theme'), 'dark');
  assert.strictEqual(eventDispatched, true, 'themechanged event should fire');
  assert.strictEqual(receivedTheme, 'dark', 'themechanged event detail should carry dark');

  // Toggle back to light
  ThemeEngine.toggleTheme();
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'light');
  assert.strictEqual(window.localStorage.getItem('theme'), 'light');
});

// 3. Router Navigation Test
runTest('Router navigates between views and updates DOM active states', () => {
  Router.init();

  let routeChangedEventFired = false;
  let currentRouteName = '';

  window.addEventListener('routechanged', (e) => {
    routeChangedEventFired = true;
    currentRouteName = e.detail ? e.detail.route : '';
  });

  // Navigate to #budget
  Router.navigateTo('budget');
  Router.render();

  assert.strictEqual(Router.getCurrentRoute(), 'budget');
  assert.strictEqual(routeChangedEventFired, true);
  assert.strictEqual(currentRouteName, 'budget');

  assert.ok(viewBg.classList.has('active'), '#view-budget section should have active class');
  assert.ok(navBg.classList.has('active'), '#nav-budget should have active class');

  // Navigate to #reports
  Router.navigateTo('reports');
  Router.render();
  assert.strictEqual(Router.getCurrentRoute(), 'reports');
  assert.ok(viewRp.classList.has('active'), '#view-reports section should have active class');

  // Navigate to invalid route -> fallbacks to transactions
  Router.navigateTo('nonexistent-route');
  Router.render();
  assert.strictEqual(Router.getCurrentRoute(), 'transactions');
});

console.log('\n----------------------------------------------------');
console.log(`Runtime Results: ${passed} / ${total} tests passed.`);
console.log('----------------------------------------------------');

if (passed !== total) {
  process.exit(1);
}
