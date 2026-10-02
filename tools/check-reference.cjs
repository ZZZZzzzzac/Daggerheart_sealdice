const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..', 'reference');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
let errors = 0;
for (const source of manifest.sources) {
  for (const [relative, expected] of Object.entries(source.files)) {
    const file = path.join(root, source.name, relative);
    try {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (actual !== expected) { console.error('Changed:', source.name, relative); errors++; }
    } catch { console.error('Missing:', source.name, relative); errors++; }
  }
}
if (errors) process.exitCode = 1;
else console.log('Reference snapshots match pinned manifests.');
