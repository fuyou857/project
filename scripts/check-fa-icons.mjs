#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dts = fs.readFileSync(path.join(root, 'node_modules/react-icons/fa/index.d.ts'), 'utf8');
const exported = new Set([...dts.matchAll(/export declare const (Fa\w+)/g)].map((m) => m[1]));

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) out.push(p);
  }
  return out;
}

const bad = [];
for (const file of walk(path.join(root, 'src'))) {
  const c = fs.readFileSync(file, 'utf8');
  const re = /import\s*\{([^}]+)\}\s*from\s*['"]react-icons\/fa['"]/gs;
  let m;
  while ((m = re.exec(c))) {
    const names = m[1]
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      .filter((s) => s && !s.startsWith('type '));
    for (const n of names) {
      if (!exported.has(n)) bad.push({ file: path.relative(root, file), name: n });
    }
  }
}
if (bad.length) {
  console.error('Invalid react-icons/fa imports (would be undefined at runtime → React #130):');
  for (const b of bad) console.error(`  ${b.file}: ${b.name}`);
  process.exit(1);
}
console.log('OK: all react-icons/fa imports exist');
