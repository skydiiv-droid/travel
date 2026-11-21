// data/seed.json 을 index.html 의 <script id="seed-data"> 블록에 인라인한다.
// (file:// 로 열어도 동작해야 해서 fetch 대신 인라인)
// 사용: node tools/build.js
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const seed = JSON.parse(fs.readFileSync(path.join(root, 'data', 'seed.json'), 'utf8'));
const html = fs.readFileSync(htmlPath, 'utf8');
const re = /(<script type="application\/json" id="seed-data">)[\s\S]*?(<\/script>)/;
if (!re.test(html)) throw new Error('seed-data block not found in index.html');
const json = JSON.stringify(seed).replace(/</g, '\\u003c');
fs.writeFileSync(htmlPath, html.replace(re, (_, a, b) => a + json + b));
console.log('inlined', seed.destinations.length, 'destinations into index.html');
