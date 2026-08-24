const jsdom = require('jsdom');
const fs = require('fs');
const { JSDOM } = jsdom;
const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), { runScripts: "dangerously", resources: "usable" });
const window = dom.window;
global.window = window;
global.document = window.document;

// ... well, a bit hard to mock everything.
