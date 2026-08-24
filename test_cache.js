const fs = require('fs');
global.localStorage = { getItem: () => null, setItem: () => null };
const catJS = fs.readFileSync('js/categories.js', 'utf8');
eval(catJS);

const forceDefault = false;

let categories = Categories.getActive('expense');
let stateKey1 = JSON.stringify(categories.map(c => c.id + c.name + c.icon + c.group)) + '_' + forceDefault;
console.log('Key 1:', stateKey1);

categories = Categories.getActive('expense');
let stateKey2 = JSON.stringify(categories.map(c => c.id + c.name + c.icon + c.group)) + '_' + forceDefault;
console.log('Key 2:', stateKey2);

console.log('Same?', stateKey1 === stateKey2);
