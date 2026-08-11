/**
 * test-utils.js - Shared Test Harness & Browser/DOM/Storage Emulation Primitives
 * Provides ONLY emulation primitives (DOM parser, LocalStorage/IndexedDB emulator,
 * Service Worker mock, mock GAS fetch server, VM sandbox module loader).
 * Contains NO internal application business logic or Spec reference classes.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// 1. Standardized Assertion Helper
const TestAssert = {
  equal: (actual, expected, msg) => assert.strictEqual(actual, expected, msg),
  deepEqual: (actual, expected, msg) => {
    try {
      assert.deepStrictEqual(actual, expected, msg);
    } catch (e) {
      if (JSON.stringify(actual) === JSON.stringify(expected)) {
        return;
      }
      throw e;
    }
  },
  isTrue: (value, msg) => assert.strictEqual(!!value, true, msg || 'Expected true'),
  isFalse: (value, msg) => assert.strictEqual(!!value, false, msg || 'Expected false'),
  isOk: (value, msg) => assert.ok(value, msg),
  throws: (fn, regExp, msg) => assert.throws(fn, regExp, msg),
  doesNotThrow: (fn, msg) => {
    try {
      fn();
    } catch (e) {
      assert.fail((msg ? msg + ' - ' : '') + 'Unexpected error thrown: ' + e.message);
    }
  },
  contains: (actual, substring, msg) => {
    assert.ok(String(actual).includes(substring), msg || `Expected "${actual}" to contain "${substring}"`);
  },
  matches: (actual, regex, msg) => {
    assert.ok(regex.test(String(actual)), msg || `Expected "${actual}" to match ${regex}`);
  },
  fail: (msg) => assert.fail(msg)
};

// 2. Mock LocalStorage Emulator
class MockLocalStorage {
  constructor() {
    this.store = new Map();
    this.throwQuotaError = false;
  }
  getItem(key) {
    return this.store.has(String(key)) ? this.store.get(String(key)) : null;
  }
  setItem(key, value) {
    if (this.throwQuotaError) {
      const err = new Error('QuotaExceededError: LocalStorage quota limit reached');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.store.set(String(key), String(value));
  }
  removeItem(key) {
    this.store.delete(String(key));
  }
  clear() {
    this.store.clear();
  }
  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }
  get length() {
    return this.store.size;
  }
}

// 3. Mock DOM Element & Document with HTML Parsing Capabilities
class MockDOMElement {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attributes };
    this.children = [];
    this.parentNode = null;
    const classSet = new Set();
    this.classList = {
      add: (...tokens) => tokens.forEach(t => t && classSet.add(t)),
      remove: (...tokens) => tokens.forEach(t => classSet.delete(t)),
      contains: (token) => classSet.has(token),
      toggle: (token, force) => {
        if (force === true) { classSet.add(token); return true; }
        if (force === false) { classSet.delete(token); return false; }
        if (classSet.has(token)) { classSet.delete(token); return false; }
        classSet.add(token); return true;
      },
      clear: () => classSet.clear(),
      has: (token) => classSet.has(token),
      forEach: (...args) => classSet.forEach(...args),
      get length() { return classSet.size; },
      get value() { return Array.from(classSet).join(' '); }
    };
    this.eventListeners = {};
    this.value = attributes.value !== undefined ? String(attributes.value) : '';
    this.checked = !!attributes.checked;
    this._innerHTML = '';
    this.innerText = '';
    this.textContent = '';
    this.style = {};
    this.dataset = {};

    if (attributes.class) {
      String(attributes.class).split(/\s+/).forEach(c => c && this.classList.add(c));
    }
    Object.keys(attributes).forEach(k => {
      if (k.startsWith('data-')) {
        const camelKey = k.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        this.dataset[camelKey] = attributes[k];
      }
    });
  }

  getContext(type) {
    return {
      canvas: this,
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      stroke: () => {},
      fill: () => {}
    };
  }

  get innerHTML() {
    return this._innerHTML || '';
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
    this.children = [];
  }

  setAttribute(name, val) {
    const stringVal = String(val);
    this.attributes[name] = stringVal;
    if (name === 'class') {
      this.classList.clear();
      stringVal.split(/\s+/).forEach(c => c && this.classList.add(c));
    }
    if (name === 'value') this.value = stringVal;
    if (name.startsWith('data-')) {
      const camelKey = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[camelKey] = stringVal;
    }
  }

  getAttribute(name) {
    return this.attributes[name] !== undefined ? this.attributes[name] : null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'class') this.classList.clear();
    if (name.startsWith('data-')) {
      const camelKey = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      delete this.dataset[camelKey];
    }
  }

  appendChild(child) {
    if (typeof child === 'string') {
      const textNode = new MockDOMElement('#text');
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
    const listeners = this.eventListeners[eventName] || [];
    const eventObj = typeof evt === 'string'
      ? { type: eventName, target: this, preventDefault: () => {}, stopPropagation: () => {} }
      : { target: this, preventDefault: () => {}, stopPropagation: () => {}, ...evt };
    listeners.forEach(fn => fn(eventObj));
    return true;
  }

  matchesSelector(selector) {
    if (selector.includes(',')) {
      return selector.split(',').some(s => this.matchesSelector(s.trim()));
    }
    const sel = selector.trim();
    if (sel.startsWith('#')) {
      return this.getAttribute('id') === sel.slice(1);
    }
    if (sel.startsWith('.')) {
      return this.classList.has(sel.slice(1));
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
    return this.tagName && this.tagName.toLowerCase() === sel.toLowerCase();
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matchesSelector && curr.matchesSelector(selector)) {
        return curr;
      }
      curr = curr.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const search = (node) => {
      for (const child of node.children || []) {
        if (child.matchesSelector && child.matchesSelector(selector)) {
          matches.push(child);
        }
        search(child);
      }
    };
    search(this);
    return matches;
  }
}

class MockDocument {
  constructor() {
    this.documentElement = new MockDOMElement('html');
    this.head = new MockDOMElement('head');
    this.body = new MockDOMElement('body');
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.readyState = 'complete';
    this.eventListeners = {};
  }

  createElement(tagName) {
    return new MockDOMElement(tagName);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const search = (node) => {
      if (node.matchesSelector && node.matchesSelector(selector)) {
        matches.push(node);
      }
      for (const child of node.children || []) {
        search(child);
      }
    };
    if (this.documentElement.matchesSelector && this.documentElement.matchesSelector(selector)) {
      matches.push(this.documentElement);
    }
    search(this.head);
    search(this.body);
    return matches;
  }

  getElementById(id) {
    return this.querySelector('#' + id);
  }

  getElementsByClassName(cls) {
    return this.querySelectorAll('.' + cls);
  }

  getElementsByTagName(tag) {
    if (tag === 'html') return [this.documentElement];
    return this.querySelectorAll(tag);
  }

  addEventListener(event, fn) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(fn);
  }

  dispatchEvent(evt) {
    const eventName = typeof evt === 'string' ? evt : evt.type;
    const listeners = this.eventListeners[eventName] || [];
    listeners.forEach(fn => fn(evt));
  }

  parseHTML(htmlContent) {
    this.head.children = [];
    this.body.children = [];

    const parseAttributes = (attrStr) => {
      const attrs = {};
      const attrRegex = /([a-zA-Z0-9_-]+)(?:=("[^"]*"|'[^']*'|[^\s>]+))?/g;
      let match;
      while ((match = attrRegex.exec(attrStr)) !== null) {
        const name = match[1];
        let val = match[2] !== undefined ? match[2] : true;
        if (typeof val === 'string' && (val.startsWith('"') || val.startsWith("'"))) {
          val = val.slice(1, -1);
        }
        attrs[name] = val;
      }
      return attrs;
    };

    const elementStack = [this.body];
    const tokenizer = /<(\/)?([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
    let match;

    while ((match = tokenizer.exec(htmlContent)) !== null) {
      const isEndTag = !!match[1];
      const tagName = match[2] ? match[2].toLowerCase() : null;
      const attrStr = match[3] || '';
      const textContent = match[4];

      if (textContent) {
        const trimmed = textContent.trim();
        if (trimmed && elementStack.length > 0) {
          const textNode = new MockDOMElement('#text');
          textNode.textContent = trimmed;
          elementStack[elementStack.length - 1].appendChild(textNode);
        }
      } else if (tagName) {
        if (tagName === 'head') {
          if (!isEndTag) elementStack.push(this.head);
          else if (elementStack[elementStack.length - 1] === this.head) elementStack.pop();
        } else if (tagName === 'body' || tagName === 'html') {
          if (!isEndTag && tagName === 'html') {
            const attrs = parseAttributes(attrStr);
            Object.keys(attrs).forEach(k => this.documentElement.setAttribute(k, attrs[k]));
          }
        } else if (isEndTag) {
          if (elementStack.length > 1 && elementStack[elementStack.length - 1].tagName.toLowerCase() === tagName) {
            elementStack.pop();
          }
        } else {
          const attrs = parseAttributes(attrStr);
          const elem = new MockDOMElement(tagName, attrs);
          if (elementStack.length > 0) {
            elementStack[elementStack.length - 1].appendChild(elem);
          }
          const selfClosing = ['meta', 'link', 'img', 'input', 'br', 'hr'].includes(tagName) || attrStr.endsWith('/');
          if (!selfClosing) {
            elementStack.push(elem);
          }
        }
      }
    }
  }
}

// 4. Mock Service Worker & Cache Storage
class MockCache {
  constructor(name) {
    this.name = name;
    this.storage = new Map();
  }
  async put(request, response) {
    const url = typeof request === 'string' ? request : request.url;
    this.storage.set(url, response);
  }
  async match(request) {
    const url = typeof request === 'string' ? request : request.url;
    return this.storage.get(url) || null;
  }
  async delete(request) {
    const url = typeof request === 'string' ? request : request.url;
    return this.storage.delete(url);
  }
  async keys() {
    return Array.from(this.storage.keys());
  }
}

class MockCacheStorage {
  constructor() {
    this.caches = new Map();
  }
  async open(name) {
    if (!this.caches.has(name)) {
      this.caches.set(name, new MockCache(name));
    }
    return this.caches.get(name);
  }
  async keys() {
    return Array.from(this.caches.keys());
  }
  async delete(name) {
    return this.caches.delete(name);
  }
  async match(request) {
    for (const cache of this.caches.values()) {
      const res = await cache.match(request);
      if (res) return res;
    }
    return null;
  }
}

class MockServiceWorkerContainer {
  constructor() {
    this.controller = {
      postMessage: (msg) => {}
    };
    this.eventListeners = {};
  }
  async register(scriptUrl) {
    return {
      active: true,
      scope: '/',
      unregister: async () => true,
      update: async () => true,
      addEventListener: () => {}
    };
  }
  addEventListener(event, fn) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(fn);
  }
}

// 5. Mock GAS Endpoint Backend Server
class MockGASServer {
  constructor() {
    this.endpointUrl = 'https://script.google.com/macros/s/AKfycbx_mock_endpoint_123456/exec';
    this.sheetRows = [];
    this.categories = [];
    this.isOffline = false;
    this.statusCode = 200;
    this.lockAcquired = true;
    this.requestLog = [];
  }

  reset() {
    this.sheetRows = [];
    this.categories = [];
    this.isOffline = false;
    this.statusCode = 200;
    this.lockAcquired = true;
    this.requestLog = [];
  }

  async handleFetch(url, options = {}) {
    this.requestLog.push({ url, options, timestamp: new Date().toISOString() });

    if (this.isOffline) {
      throw new Error('TypeError: Failed to fetch (Network offline)');
    }
    if (this.statusCode !== 200) {
      return {
        ok: false,
        status: this.statusCode,
        json: async () => ({ status: 'error', message: `Server error ${this.statusCode}` }),
        text: async () => JSON.stringify({ status: 'error', message: `Server error ${this.statusCode}` })
      };
    }
    if (!this.lockAcquired) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'error', message: 'ScriptLock timeout' }),
        text: async () => JSON.stringify({ status: 'error', message: 'ScriptLock timeout' })
      };
    }

    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (e) {
      urlObj = new URL(url, 'https://script.google.com');
    }
    const action = urlObj.searchParams.get('action');

    if (options.method === 'POST' || (options.body && options.body.length)) {
      let bodyData = {};
      try {
        bodyData = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      } catch (e) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'error', message: 'Malformed JSON payload' }),
          text: async () => JSON.stringify({ status: 'error', message: 'Malformed JSON payload' })
        };
      }

      if (bodyData.action === 'syncBatch') {
        const syncedIds = [];
        const remoteUpdates = [];
        const incomingTx = bodyData.transactions || [];

        for (const item of incomingTx) {
          const idx = this.sheetRows.findIndex(r => r.id === item.id);
          if (item.sync_status === 'pending_delete') {
            if (idx !== -1) this.sheetRows.splice(idx, 1);
            syncedIds.push(item.id);
          } else {
            if (idx !== -1) {
              const localTime = new Date(item.updated_at || item.created_at).getTime();
              const serverTime = new Date(this.sheetRows[idx].updated_at || this.sheetRows[idx].created_at).getTime();
              if (localTime >= serverTime) {
                this.sheetRows[idx] = { ...item, sync_status: 'synced' };
                syncedIds.push(item.id);
              } else {
                remoteUpdates.push(this.sheetRows[idx]);
              }
            } else {
              this.sheetRows.push({ ...item, sync_status: 'synced' });
              syncedIds.push(item.id);
            }
          }
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'success', synced_ids: syncedIds, remote_updates: remoteUpdates }),
          text: async () => JSON.stringify({ status: 'success', synced_ids: syncedIds, remote_updates: remoteUpdates })
        };
      }
    }

    if (action === 'ping') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok', version: '1.0' }),
        text: async () => JSON.stringify({ status: 'ok', version: '1.0' })
      };
    }

    if (action === 'fetchAll') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'success', transactions: this.sheetRows, categories: this.categories }),
        text: async () => JSON.stringify({ status: 'success', transactions: this.sheetRows, categories: this.categories })
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 'error', message: 'Unknown action' }),
      text: async () => JSON.stringify({ status: 'error', message: 'Unknown action' })
    };
  }
}

// 6. Test Environment Sandbox Container
class TestEnvironment {
  constructor(projectRoot = '/Users/mrdong/So Thu Chi') {
    this.projectRoot = projectRoot;
    this.localStorage = new MockLocalStorage();
    this.document = new MockDocument();
    this.caches = new MockCacheStorage();
    this.gasServer = new MockGASServer();
    this.serviceWorkerContainer = new MockServiceWorkerContainer();
    this.loadErrors = {};

    this.window = {
      localStorage: this.localStorage,
      document: this.document,
      caches: this.caches,
      location: {
        href: 'http://localhost/index.html#transactions',
        origin: 'http://localhost',
        protocol: 'http:',
        host: 'localhost',
        hostname: 'localhost',
        port: '',
        pathname: '/index.html',
        search: '',
        hash: '#transactions',
        reload: () => {},
        replace: () => {},
        assign: () => {}
      },
      history: {
        pushState: () => {},
        replaceState: () => {},
        back: () => {},
        forward: () => {}
      },
      matchMedia: (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {}
      }),
      navigator: {
        onLine: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        serviceWorker: this.serviceWorkerContainer
      },
      fetch: this.gasServer.handleFetch.bind(this.gasServer),
      addEventListener: (evt, fn) => this.document.addEventListener(evt, fn),
      dispatchEvent: (evt) => this.document.dispatchEvent(evt)
    };

    // Pre-parse index.html into document if present
    const htmlPath = path.join(this.projectRoot, 'index.html');
    if (fs.existsSync(htmlPath)) {
      this.document.parseHTML(fs.readFileSync(htmlPath, 'utf8'));
    }

    this.context = vm.createContext({
      window: this.window,
      document: this.document,
      localStorage: this.localStorage,
      caches: this.caches,
      navigator: this.window.navigator,
      fetch: this.window.fetch,
      console: console,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      Date: Date,
      Math: Math,
      JSON: JSON,
      RegExp: RegExp,
      Array: Array,
      Object: Object,
      Number: Number,
      String: String,
      Boolean: Boolean,
      Error: Error,
      CustomEvent: class CustomEvent {
        constructor(type, params = {}) {
          this.type = type;
          this.detail = params.detail || null;
        }
      }
    });
  }

  get db() {
    return this.context.DB || this.window.DB || this.context.db || this.window.db;
  }
  get categoryManager() {
    return this.context.CategoryManager || this.context.Categories || this.window.CategoryManager || this.window.Categories;
  }
  get historyManager() {
    return this.context.HistoryManager || this.context.History || this.window.HistoryManager || this.window.History;
  }
  get chartManager() {
    return this.context.ChartManager || this.context.Charts || this.window.ChartManager || this.window.Charts;
  }
  get syncEngine() {
    return this.context.SyncEngine || this.context.Sync || this.window.SyncEngine || this.window.Sync;
  }

  // Load disk JS files into VM sandbox context
  loadSourceFiles() {
    const jsFiles = ['js/db.js', 'js/categories.js', 'js/history.js', 'js/charts.js', 'js/sync.js', 'app.js'];
    for (const file of jsFiles) {
      const fullPath = path.join(this.projectRoot, file);
      if (fs.existsSync(fullPath)) {
        const code = fs.readFileSync(fullPath, 'utf8');
        try {
          vm.runInContext(code, this.context);
          for (const key of Object.keys(this.window)) {
            this.context[key] = this.window[key];
          }
        } catch (err) {
          this.loadErrors[file] = err;
        }
      }
    }
    for (const key of Object.keys(this.window)) {
      this.context[key] = this.window[key];
    }
  }
}

// 7. Test Execution Wrapper
async function runTestCase(testId, title, testFn) {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    return { id: testId, title, passed: true, duration, error: null };
  } catch (err) {
    const duration = Date.now() - start;
    return { id: testId, title, passed: false, duration, error: err };
  }
}

module.exports = {
  TestAssert,
  MockLocalStorage,
  MockDOMElement,
  MockDocument,
  MockCache,
  MockCacheStorage,
  MockServiceWorkerContainer,
  MockGASServer,
  TestEnvironment,
  runTestCase
};
