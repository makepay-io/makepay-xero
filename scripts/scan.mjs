import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const forbidden = [
  new RegExp(['j', 'o', 'z', 'e', 'f'].join(''), 'i'),
  new RegExp(['o', 'r', 'a', 'n', 'g', 'e', 'b', 't', 'c'].join(''), 'i'),
  new RegExp(`${['v', 'c', 'p', '_'].join('')}[A-Za-z0-9]+`),
  new RegExp(`${['s', 'b', 'p', '_'].join('')}[A-Za-z0-9]+`),
  new RegExp(['P', 'a', 'y', 'm', 'e', 'n', 't', 's', '2', '0', '2', '5'].join('')),
];

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (entry === '.git' || entry === 'node_modules' || entry === 'dist') {
      return [];
    }
    return statSync(fullPath).isDirectory() ? walk(fullPath) : [fullPath];
  });
}

let failed = false;

for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      console.error(`${relative(root, file)} contains forbidden or sensitive text.`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log('Secret and identifier scan passed.');
