const fs = require('fs');
const file = './src/app/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\brounded(-xl|-md|-2xl|)\b/g, 'rounded-[8px]');
content = content.replace(/\brounded-lg\b/g, 'rounded-[8px]');

fs.writeFileSync(file, content);
console.log("Done");