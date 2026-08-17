#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const target = path.join(root, 'public/js/main.js');

const source = fs.readFileSync(target, 'utf8');
const lines = source.split(/\n/);

const results = [];

const isLikelyLiteralAssignment = (line) => (
  /textContent\s*=/.test(line)
  && /(?:`[^`]*`|"[^"]*"|'[^']*')/.test(line)
  && !/\btr\(/.test(line)
  && !/I18N\.t\(/.test(line)
);

const isLikelyTranslatableAttr = (line) => (
  /setAttribute\((['"])(aria-label|title|placeholder)\1\s*,/.test(line)
  && !/\btr\(/.test(line)
  && !/I18N\.t\(/.test(line)
);

for (let idx = 0; idx < lines.length; idx += 1) {
  const line = lines[idx];
  if (isLikelyLiteralAssignment(line) || isLikelyTranslatableAttr(line)) {
    results.push({
      line: idx + 1,
      code: line.trim(),
      type: isLikelyTranslatableAttr(line) ? 'attr' : 'text',
    });
  }
}

const textCount = results.filter((r) => r.type === 'text').length;
const attrCount = results.filter((r) => r.type === 'attr').length;

console.log(`Potential runtime i18n bypasses in public/js/main.js`);
console.log(`- textContent literal writes: ${textCount}`);
console.log(`- aria/title/placeholder writes: ${attrCount}`);
console.log(`- total: ${results.length}`);
console.log('');

results.forEach((r) => {
  console.log(`${r.line}:${r.code}`);
});

process.exit(0);
