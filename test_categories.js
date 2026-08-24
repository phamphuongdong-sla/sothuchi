const fs = require('fs');
// Mocking localStorage
global.localStorage = { getItem: () => null, setItem: () => null };
const catJS = fs.readFileSync('js/categories.js', 'utf8');
eval(catJS);
const cats = Categories.getActive('expense');
console.log(cats.map(c => c.id + c.name + c.icon + c.group).slice(0, 2));
