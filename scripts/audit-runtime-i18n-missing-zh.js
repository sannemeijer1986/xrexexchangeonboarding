#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mainPath = path.join(root, 'public/js/main.js');
const zhPath = path.join(root, 'public/i18n/zh.json');

const main = fs.readFileSync(mainPath, 'utf8').split(/\n/);
const zh = JSON.parse(fs.readFileSync(zhPath, 'utf8'));

const stripQuotes = (s) => {
  if (!s || s.length < 2) return s;
  const q = s[0];
  if ((q === '"' || q === "'") && s[s.length - 1] === q) return s.slice(1, -1);
  return s;
};

const candidates = new Map();

for (let i = 0; i < main.length; i += 1) {
  const line = main[i].trim();
  if (!line || line.startsWith('//')) continue;
  if (/\btr\(/.test(line) || /I18N\.t\(/.test(line)) continue;

  const m1 = line.match(/textContent\s*=\s*(['"])(.*?)\1/);
  const m2 = line.match(/setAttribute\((['"])(aria-label|title|placeholder)\1\s*,\s*(['"])(.*?)\3\)/);
  const raw = m2 ? m2[4] : (m1 ? m1[2] : null);
  if (!raw) continue;
  if (!/[A-Za-z]/.test(raw)) continue;
  if (/\$\{/.test(raw)) continue;

  const key = stripQuotes(raw).trim();
  if (!key) continue;
  if (!candidates.has(key)) candidates.set(key, []);
  candidates.get(key).push(i + 1);
}

const missing = [...candidates.entries()]
  .filter(([key]) => !Object.prototype.hasOwnProperty.call(zh, key))
  .map(([key, lines]) => ({ key, lines }));

console.log('Static runtime literals missing from zh.json');
console.log(`- candidate keys: ${candidates.size}`);
console.log(`- missing keys: ${missing.length}`);
console.log('');
missing
  .sort((a, b) => a.key.localeCompare(b.key))
  .forEach(({ key, lines }) => {
    console.log(`${key}  [lines: ${lines.join(', ')}]`);
  });

