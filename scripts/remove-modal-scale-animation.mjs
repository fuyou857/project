#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const replacements = [
  [
    /initial=\{\{\s*opacity:\s*0,\s*scale:\s*0\.95\s*\}\}\s*animate=\{\{\s*opacity:\s*1,\s*scale:\s*1\s*\}\}\s*exit=\{\{\s*opacity:\s*0,\s*scale:\s*0\.95\s*\}\}/g,
    'initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}',
  ],
  [
    /initial=\{\{\s*scale:\s*0\.95,\s*opacity:\s*0\s*\}\}\s*animate=\{\{\s*scale:\s*1,\s*opacity:\s*1\s*\}\}\s*exit=\{\{\s*scale:\s*0\.95,\s*opacity:\s*0\s*\}\}/g,
    'initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}',
  ],
  [
    /initial=\{\{\s*scale:\s*0\.9\s*\}\}\s*animate=\{\{\s*scale:\s*1\s*\}\}\s*exit=\{\{\s*scale:\s*0\.9\s*\}\}/g,
    'initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}',
  ],
  [
    /initial=\{\{\s*scale:\s*0\.9,\s*opacity:\s*0\s*\}\}\s*animate=\{\{\s*scale:\s*1,\s*opacity:\s*1\s*\}\}\s*exit=\{\{\s*scale:\s*0\.9,\s*opacity:\s*0\s*\}\}/g,
    'initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}',
  ],
  [
    /initial=\{\{\s*scale:\s*0\.96\s*\}\}\s*animate=\{\{\s*scale:\s*1\s*\}\}/g,
    'initial={{ opacity: 0 }} animate={{ opacity: 1 }}',
  ],
  [
    /initial=\{\{\s*scale:\s*0\.9\s*\}\}\s*animate=\{\{\s*scale:\s*1\s*\}\}/g,
    'initial={{ opacity: 0 }} animate={{ opacity: 1 }}',
  ],
  [
    /initial=\{\{\s*opacity:\s*0,\s*scale:\s*0\.95\s*\}\}\s*animate=\{\{\s*opacity:\s*1,\s*scale:\s*1\s*\}\}/g,
    'initial={{ opacity: 0 }} animate={{ opacity: 1 }}',
  ],
];

let changedFiles = 0;
for (const path of walk(join(root, 'src'))) {
  const src = readFileSync(path, 'utf8');
  let next = src;
  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }
  if (next !== src) {
    writeFileSync(path, next);
    changedFiles += 1;
    console.log('updated:', path.replace(root + '/', ''));
  }
}
console.log(`done: ${changedFiles} file(s)`);
