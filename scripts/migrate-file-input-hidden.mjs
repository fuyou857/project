#!/usr/bin/env node
/**
 * 将 type="file" 的 className="hidden" 迁移为 Edge 安全的 ui-file-input-* 类。
 */
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

function migrateFile(path) {
  let src = readFileSync(path, 'utf8');
  const original = src;

  // 仅 file input：单行或多行属性块
  src = src.replace(
    /(<input[\s\S]*?type="file"[\s\S]*?)className="hidden"/g,
    '$1className="ui-file-input-safe" data-file-upload-field="true"',
  );
  src = src.replace(
    /(<input[\s\S]*?)className="hidden"([\s\S]*?type="file"[\s\S]*?>)/g,
    '$1className="ui-file-input-safe" data-file-upload-field="true"$2',
  );

  // label 内 file input 改用 overlay，并为 label 补 relative
  src = src.replace(/<label([^>]*)>([\s\S]*?)<\/label>/g, (full, attrs, inner) => {
    if (!/type="file"/.test(inner) || !/ui-file-input-safe/.test(inner)) return full;
    let nextAttrs = attrs;
    if (!/\brelative\b/.test(nextAttrs)) {
      nextAttrs = attrs.includes('className=')
        ? attrs.replace(/className="([^"]*)"/, 'className="$1 relative"')
        : `${attrs} className="relative"`;
    }
    const nextInner = inner.replace(
      /className="ui-file-input-safe"/g,
      'className="ui-file-input-overlay"',
    );
    return `<label${nextAttrs}>${nextInner}</label>`;
  });

  if (src !== original) {
    writeFileSync(path, src);
    return true;
  }
  return false;
}

let count = 0;
for (const path of walk(join(root, 'src'))) {
  if (migrateFile(path)) {
    count += 1;
    console.log('updated:', path.replace(root + '/', ''));
  }
}
console.log(`done: ${count} file(s)`);
