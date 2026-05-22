import fs from 'fs';
import path from 'path';

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk('./src');
const problematicFiles = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('<FaSearch')) {
    // Use 's' flag for multiline match
    const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]react-icons\/fa['"]/s);
    if (importMatch) {
      const importedIcons = importMatch[1].split(/,|\s+/).map(s => s.trim()).filter(Boolean);
      if (!importedIcons.includes('FaSearch')) {
        problematicFiles.push(file);
      }
    } else {
      problematicFiles.push(file + " (No react-icons/fa import found)");
    }
  }
}

console.log('Problematic files (FaSearch used in JSX but not imported from react-icons/fa):');
problematicFiles.forEach(f => console.log(f));
