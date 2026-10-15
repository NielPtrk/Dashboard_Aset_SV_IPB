const fs = require('fs');
const path = require('path');

const chunkDir = path.join(__dirname, 'node_modules', 'vite', 'dist', 'node', 'chunks');
if (fs.existsSync(chunkDir)) {
  const files = fs.readdirSync(chunkDir);
  for (const f of files) {
    if (f.endsWith('.js')) {
      const full = path.join(chunkDir, f);
      let content = fs.readFileSync(full, 'utf8');
      if (content.includes("constants as constants$3 } from 'node:fs/promises'")) {
        content = content.replace(
          "import fsp, { constants as constants$3 } from 'node:fs/promises';",
          "import fsp from 'node:fs/promises'; import { constants as constants$3 } from 'node:fs';"
        );
        fs.writeFileSync(full, content, 'utf8');
        console.log('Patched', f);
      }
      if (content.includes("{ constants } from 'node:fs/promises'")) {
        content = content.replace(
          "{ constants } from 'node:fs/promises'",
          "{ constants } from 'node:fs'"
        );
        fs.writeFileSync(full, content, 'utf8');
        console.log('Patched constants in', f);
      }
    }
  }
}
console.log('Vite patch complete');
